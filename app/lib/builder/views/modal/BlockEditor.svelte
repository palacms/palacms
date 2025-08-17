<script module>
	import { writable, get } from 'svelte/store'
	const orientation = writable('horizontal')
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import LargeSwitch from '$lib/builder/ui/LargeSwitch.svelte'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import FullCodeEditor from './SectionEditor/FullCodeEditor.svelte'
	import ComponentPreview, { has_error } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields, { setFieldEntries } from '$lib/builder/components/Fields/FieldsContent.svelte'
	import { locale } from '$lib/builder/stores/app/misc.js'
	import hotkey_events from '$lib/builder/stores/app/hotkey_events.js'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { LibrarySymbolEntries, LibrarySymbolFields, LibrarySymbolGroups, LibrarySymbols, manager, Sites, SiteSymbolEntries, SiteSymbolFields, SiteSymbols } from '$lib/pocketbase/collections'
	import { page } from '$app/state'
	import { getContent } from '$lib/pocketbase/content'
	import { browser } from '$app/environment'
	import _ from 'lodash-es'

	let {
		block: existing_block,
		tab = $bindable('content'),
		has_unsaved_changes = $bindable(false),
		header = {
			label: 'Create Component',
			icon: 'fas fa-code',
			button: {
				icon: 'fas fa-plus',
				label: 'Add to page',
				onclick: (component) => {
					console.warn('Component not going anywhere', component)
				}
			}
		},
		symbol_type
	}: {
		block?: ObjectOf<typeof SiteSymbols> | ObjectOf<typeof LibrarySymbols>
		tab?: string
		has_unsaved_changes?: boolean
		header?: any
		symbol_type?: 'site' | 'library'
	} = $props()

	// Choose the right collections based on symbol type
	const SymbolCollection = $derived(symbol_type === 'library' ? LibrarySymbols : SiteSymbols)
	const FieldCollection = $derived(symbol_type === 'library' ? LibrarySymbolFields : SiteSymbolFields)
	const EntryCollection = $derived(symbol_type === 'library' ? LibrarySymbolEntries : SiteSymbolEntries)

	const host = $derived(page.url.host)
	const site = $derived(symbol_type !== 'library' && host ? Sites.list({ filter: `host = "${host}"` })?.[0] : undefined)

	const active_symbol_group_id = $derived(page.url.searchParams.get('group'))
	const active_symbol_group = $derived(symbol_type === 'library' && active_symbol_group_id ? LibrarySymbolGroups.one(active_symbol_group_id) : undefined)

	const new_block = () => {
		if (symbol_type === 'library') {
			if (!active_symbol_group) {
				throw new Error('Symbol group not loaded')
			}
			return LibrarySymbols.create({ css: '', html: '', js: '', name: 'New Block', group: active_symbol_group.id })
		} else {
			if (!site) {
				throw new Error('Site not loaded')
			}
			return SiteSymbols.create({ css: '', html: '', js: '', name: 'New Block', site: site.id })
		}
	}
	const block = $state(existing_block ?? new_block())

	const fields = $derived('site' in block ? block.fields() : block.fields())
	const entries = $derived('site' in block ? block.entries() : block.entries())
	let component_data = $derived(fields && entries && (getContent(block, fields, entries)[$locale] ?? {}))

	let loading = $state(false)

	// Set up hotkey listeners with cleanup
	$effect(() => {
		const unsubscribe_e = hotkey_events.on('e', toggle_tab)
		const unsubscribe_save = hotkey_events.on('save', save_component)

		// Cleanup on unmount
		return () => {
			unsubscribe_e()
			unsubscribe_save()
		}
	})

	function toggle_tab() {
		tab = tab === 'code' ? 'content' : 'code'
	}

	async function save_component() {
		if (!$has_error) {
			loading = true
			await manager.commit()
			loading = false
			header.button.onclick(block)
		}
	}

	let html = $state(block.html)
	let css = $state(block.css)
	let js = $state(block.js)

	// Store initial data for comparison
	const initial_code = { html: block.html, css: block.css, js: block.js }
	const initial_data = _.cloneDeep(component_data)

	// Compare current state to initial data
	$effect(() => {
		const code_changed = html !== initial_code.html || css !== initial_code.css || js !== initial_code.js
		const data_changed = !_.isEqual(initial_data, component_data)
		has_unsaved_changes = code_changed || data_changed
	})

	// Add beforeunload listener to warn about unsaved changes
	$effect(() => {
		if (!browser) return

		const handleBeforeUnload = (e) => {
			if (has_unsaved_changes) {
				e.preventDefault()
				e.returnValue = ''
				return ''
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => window.removeEventListener('beforeunload', handleBeforeUnload)
	})

	// Create code object for ComponentPreview)
	let code = $derived({
		html: html || '<!-- Add your HTML here -->',
		css: css || '/* Add your CSS here */',
		js: js || ''
	})
</script>

<Dialog.Header
	class="mb-2"
	title={block.name || 'Block'}
	button={{
		...header.button,
		hint: '⌘S',
		loading,
		onclick: save_component,
		disabled: $has_error || loading
	}}
>
	<LargeSwitch bind:active_tab_id={tab} />
</Dialog.Header>

<main lang={$locale}>
	<PaneGroup direction={$orientation} class="flex">
		<Pane defaultSize={50}>
			{#if tab === 'code'}
				<FullCodeEditor
					bind:html
					bind:css
					bind:js
					data={component_data}
					on:save={save_component}
					on:mod-e={toggle_tab}
					oninput={() => {
						SymbolCollection.update(block.id, {
							html,
							css,
							js
						})
					}}
				/>
			{:else if tab === 'content' && fields && entries}
				<Fields
					entity={block}
					{fields}
					{entries}
					create_field={async (data) => {
						// Get the highest index for fields at this level
						const siblingFields = (fields ?? []).filter((f) => (data?.parent ? f.parent === data.parent : !f.parent))
						const nextIndex = Math.max(...siblingFields.map((f) => f.index || 0), -1) + 1

						return FieldCollection.create({
							type: 'text',
							key: '',
							label: '',
							config: null,
							symbol: block.id,
							...data,
							index: nextIndex
						})
					}}
					oninput={(values) => {
						setFieldEntries({
							fields,
							entries,
							updateEntry: EntryCollection.update,
							createEntry: EntryCollection.create,
							values
						})
					}}
					onchange={({ id, data }) => {
						FieldCollection.update(id, data)
					}}
					ondelete={(field_id) => {
						FieldCollection.delete(field_id)
					}}
				/>
			{/if}
		</Pane>
		<PaneResizer class="PaneResizer" />
		<Pane defaultSize={50}>
			{#if component_data}
				<ComponentPreview bind:orientation={$orientation} view="small" {loading} {code} data={component_data} />
			{/if}
		</Pane>
	</PaneGroup>
</main>

<style lang="postcss">
	main {
		display: flex; /* to help w/ positioning child items in code view */
		background: var(--primo-color-black);
		color: var(--color-gray-2);
		padding: 0 0.5rem;
		flex: 1;
		overflow: hidden;

		--Button-bg: var(--color-gray-8);
		--Button-bg-hover: var(--color-gray-9);
	}
</style>
