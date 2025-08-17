<script module>
	import { writable, get } from 'svelte/store'
	const orientation = writable('horizontal')
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import LargeSwitch from '../../../ui/LargeSwitch.svelte'
	import FullCodeEditor from './FullCodeEditor.svelte'
	import ComponentPreview, { refresh_preview, has_error } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields, { setFieldEntries } from '../../../components/Fields/FieldsContent.svelte'
	import { locale } from '../../../stores/app/misc.js'
	import hotkey_events from '../../../stores/app/hotkey_events.js'
	import { getContent } from '$lib/pocketbase/content'
	import * as Mousetrap from 'mousetrap'
	import { browser } from '$app/environment'
	import { PageSectionEntries, PageSections, PageEntries, PageTypeSectionEntries, SiteSymbolFields, SiteSymbols, SiteSymbolEntries, SiteEntries, manager } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import type { PageTypeSection } from '$lib/common/models/PageTypeSection'
	import { current_user } from '$lib/pocketbase/user'
	import _ from 'lodash-es'

	let {
		component,
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
		}
	}: {
		component: ObjectOf<typeof PageTypeSection> | ObjectOf<typeof PageSections>
		tab: string
		has_unsaved_changes: boolean
		header?: any
	} = $props()

	// Data will be loaded automatically by CollectionMapping system when accessed

	const symbol = $derived(SiteSymbols.one(component.symbol))
	const fields = $derived(symbol?.fields())
	const entries = $derived('page_type' in component ? component.entries() : 'page' in component ? component.entries() : undefined)
	const component_data = $derived(fields && entries && (getContent(component, fields, entries)[$locale] ?? {}))

	const initial_code = { html: symbol?.html, css: symbol?.css, js: symbol?.js }
	const initial_data = _.cloneDeep(component_data)
	let loading = $state(false)
	let newly_created_fields = new Set()

	// Create completions array in field order for autocomplete
	const completions = $derived(
		fields && component_data
			? fields
					.filter((field) => field.key && component_data.hasOwnProperty(field.key))
					.sort((a, b) => (a.index || 0) - (b.index || 0))
					.map((field, index) => {
						const value = component_data[field.key]
						const detail = Array.isArray(value)
							? `[ ${typeof value[0]} ]`
							: typeof value === 'object' && value !== null
								? '{ ' +
									Object.entries(value)
										.map(([key, val]) => `${key}:${typeof val}`)
										.join(', ') +
									' }'
								: typeof value

						return {
							label: field.key,
							type: 'variable',
							detail,
							boost: 100 - index, // Higher boost for earlier fields (maintains order)
							apply: (view, completion, from, to) => {
								// Check if there's already a closing bracket after the cursor
								const afterCursor = view.state.doc.sliceString(to, to + 1)
								const insert = field.key + (afterCursor === '}' ? '' : '}')
								view.dispatch({
									changes: { from, to, insert }
								})
							}
						}
					})
			: []
	)

	// Set up hotkey listeners with cleanup
	$effect.pre(() => {
		const unsubscribe_e = hotkey_events.on('e', toggle_tab)
		const unsubscribe_save = hotkey_events.on('save', save_component)

		// Cleanup on unmount
		return () => {
			unsubscribe_e()
			unsubscribe_save()
		}
	})

	function toggle_tab() {
		if ($current_user?.siteRole !== 'developer') {
			return
		}

		tab = tab === 'code' ? 'content' : 'code'
	}

	async function save_component() {
		// if (!$preview_updated) {
		// 	await refresh_preview()
		// }

		if (!$has_error && symbol) {
			loading = true

			// Copy entries for newly created fields to the symbol
			if (newly_created_fields.size > 0 && entries) {
				for (const fieldId of newly_created_fields) {
					// Find entries for this field in the section (only top-level entries for now)
					const fieldEntries = entries.filter((e) => e.field === fieldId && !e.parent)

					// Copy each entry to the symbol (newly created fields won't have symbol entries yet)
					for (const entry of fieldEntries) {
						SiteSymbolEntries.create({
							field: entry.field,
							locale: entry.locale,
							value: entry.value,
							index: entry.index
							// Note: not copying parent relationships for now as that would require complex mapping
						})
					}
				}

				// Clear the set after copying
				newly_created_fields.clear()
			}

			SiteSymbols.update(symbol.id, { html, css, js })
			await manager.commit()
			loading = false

			header.button.onclick()
		}
	}

	let html = $state(symbol?.html ?? '')
	let css = $state(symbol?.css ?? '')
	let js = $state(symbol?.js ?? '')

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
	title={symbol?.name || 'Block'}
	button={{
		label: header.button.label || 'Save',
		hint: '⌘S',
		loading,
		onclick: save_component,
		disabled: $has_error || loading
	}}
>
	{#if $current_user?.siteRole === 'developer'}
		<LargeSwitch bind:active_tab_id={tab} />
	{/if}
</Dialog.Header>

<main lang={$locale}>
	<PaneGroup direction={$orientation} class="flex gap-1">
		<Pane defaultSize={50} class="flex flex-col">
			{#if tab === 'code'}
				<FullCodeEditor
					bind:html
					bind:css
					bind:js
					data={component_data}
					{completions}
					on:save={save_component}
					on:mod-e={toggle_tab}
					on:mod-r={() => $refresh_preview()}
					oninput={() => {
						SiteSymbols.update(symbol.id, { html, css, js })
					}}
				/>
			{:else if tab === 'content' && fields && entries}
				<Fields
					entity={component}
					{fields}
					{entries}
					create_field={(data) => {
						if (!symbol) {
							return
						}

						// Get the highest index for fields at this level
						const siblingFields = (fields ?? []).filter((f) => (data?.parent ? f.parent === data.parent : !f.parent))
						const nextIndex = Math.max(...siblingFields.map((f) => f.index || 0), -1) + 1

						const newField = SiteSymbolFields.create({
							type: 'text',
							key: '',
							label: '',
							config: null,
							symbol: symbol.id,
							...data,
							index: nextIndex
						})

						// Track this as a newly created field
						if (newField) {
							newly_created_fields.add(newField.id)
						}

						return newField
					}}
					oninput={(values) => {
						if ('page_type' in component) {
							setFieldEntries({
								fields,
								entries,
								updateEntry: PageTypeSectionEntries.update,
								createEntry: (data) => PageTypeSectionEntries.create({ ...data, section: component.id }),
								values
							})
						} else {
							setFieldEntries({
								fields,
								entries,
								updateEntry: PageSectionEntries.update,
								createEntry: (data) => PageSectionEntries.create({ ...data, section: component.id }),
								values
							})
						}
					}}
					onchange={({ id, data }) => {
						SiteSymbolFields.update(id, data)
					}}
					ondelete={(field_id) => {
						// PocketBase cascade deletion will automatically clean up all associated entries
						SiteSymbolFields.delete(field_id)
					}}
				/>
			{/if}
		</Pane>
		<PaneResizer class="PaneResizer" />
		<Pane defaultSize={50}>
			{#if component_data}
				<ComponentPreview {code} data={component_data} bind:orientation={$orientation} view="small" {loading} />
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

	:global(.PaneResizer) {
		width: 3px;
		background: var(--color-gray-9);
	}
</style>
