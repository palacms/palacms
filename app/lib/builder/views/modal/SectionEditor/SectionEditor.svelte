<script module>
	import { writable, get } from 'svelte/store'
	const orientation = writable('horizontal')
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
	import Icon from '@iconify/svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import LargeSwitch from '../../../ui/LargeSwitch.svelte'
	import FullCodeEditor from './FullCodeEditor.svelte'
	import ComponentPreview, { refresh_preview, has_error } from '$lib/builder/components/ComponentPreview.svelte'
	import Fields, { setFieldEntries } from '../../../components/Fields/FieldsContent.svelte'
	import { locale } from '../../../stores/app/misc.js'
	import hotkey_events from '../../../stores/app/hotkey_events.js'
	import { getContent } from '$lib/pocketbase/content'
	import { browser } from '$app/environment'
	import { PageSectionEntries, PageSections, PageEntries, PageTypeSectionEntries, SiteSymbolFields, SiteSymbols, SiteSymbolEntries, SiteEntries, manager } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import type { PageTypeSection } from '$lib/common/models/PageTypeSection'
	import { current_user } from '$lib/pocketbase/user'
	import { self as pb } from '$lib/pocketbase/PocketBase'
	import { Sparkles } from 'lucide-svelte'
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

	// AI generation state
	let show_ai_prompt = $state(false)
	let ai_prompt = $state('')
	let ai_generating = $state(false)

	// Claude API function to generate Svelte component
	async function generate_svelte_component() {
		if (!ai_prompt.trim()) {
			alert('Please enter a prompt')
			return
		}

		ai_generating = true

		try {
			// Prepare field context for AI
			const field_context = fields
				? fields.map((field) => {
						const base_info = {
							key: field.key,
							label: field.label,
							type: field.type
						}

						// Add type-specific information
						if (field.type === 'image') {
							return { ...base_info, type: { url: 'string', alt: 'string' } }
						} else if (field.type === 'repeater') {
							return { ...base_info, type: 'array' }
						} else if (field.type === 'switch') {
							return { ...base_info, type: 'boolean' }
						} else if (field.type === 'number') {
							return { ...base_info, type: 'number' }
						} else {
							return { ...base_info, type: 'string' }
						}
					})
				: []

			// Call PocketBase custom endpoint
			const data = await pb.send('/api/generate-component', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					prompt: ai_prompt,
					existing_code: {
						html: html || '',
						css: css || '',
						js: js || ''
					},
					fields: field_context
				})
			})

			// Update the code editor with generated content
			if (data.html) {
				html = data.html
			}
			if (data.css) {
				css = data.css
			}
			if (data.js) {
				js = data.js
			}

			// Clear prompt and hide dialog
			ai_prompt = ''
			show_ai_prompt = false
		} catch (error) {
			console.error('Error generating component:', error)
			alert(`Failed to generate component: ${error.message}`)
		} finally {
			ai_generating = false
		}
	}

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

<!-- AI Prompt Dialog -->
{#if show_ai_prompt}
	<div class="ai-prompt-overlay">
		<div class="ai-prompt-dialog">
			<div class="ai-prompt-header">
				<h3>Modify Component with AI</h3>
				<button class="close-btn" onclick={() => (show_ai_prompt = false)}>
					<Icon icon="mdi:close" />
				</button>
			</div>
			<div class="ai-prompt-body">
				<label>
					<span>Describe what you want to change or add:</span>
					<textarea bind:value={ai_prompt} placeholder="e.g., Add a subtitle below the title, change the button to be green, make the layout responsive..." rows="4" disabled={ai_generating} />
				</label>
			</div>
			<div class="ai-prompt-footer">
				<button class="cancel-btn" onclick={() => (show_ai_prompt = false)} disabled={ai_generating}>Cancel</button>
				<button class="generate-btn" onclick={generate_svelte_component} disabled={ai_generating || !ai_prompt.trim()}>
					{ai_generating ? 'Modifying...' : 'Modify Component'}
				</button>
			</div>
		</div>
	</div>
{/if}

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
		<LargeSwitch bind:active_tab_id={tab}>
			{#if tab === 'code'}
				<button class="ai-button" onclick={() => (show_ai_prompt = true)} title="Generate with AI">
					<Sparkles class="w-3" />
					<span>AI</span>
				</button>
			{/if}
		</LargeSwitch>
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
					storage_key={symbol?.id}
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
	.ai-button {
		border: 1px solid #222;
		padding: 4px 10px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		transition: opacity 0.2s;
		margin-left: 8px;

		&:hover {
			opacity: 0.9;
		}
	}

	.ai-prompt-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.ai-prompt-dialog {
		background: var(--color-gray-9);
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		color: var(--primo-color-white);
	}

	.ai-prompt-header {
		padding: 20px;
		border-bottom: 1px solid var(--color-gray-8);
		display: flex;
		justify-content: space-between;
		align-items: center;

		h3 {
			margin: 0;
			font-size: 18px;
		}

		.close-btn {
			background: transparent;
			color: var(--color-gray-4);
			padding: 4px;
			transition: color 0.2s;

			&:hover {
				color: var(--primo-color-white);
			}
		}
	}

	.ai-prompt-body {
		padding: 20px;

		label {
			display: block;
			margin-bottom: 16px;

			span {
				display: block;
				margin-bottom: 8px;
				font-size: 14px;
				color: var(--color-gray-4);
			}

			textarea {
				width: 100%;
				background: var(--color-gray-8);
				border: 1px solid var(--color-gray-7);
				color: var(--primo-color-white);
				padding: 10px;
				border-radius: 4px;
				font-size: 14px;

				&:focus {
					outline: none;
					border-color: var(--weave-primary-color);
				}

				&:disabled {
					opacity: 0.5;
				}
			}

			textarea {
				resize: vertical;
				min-height: 100px;
			}
		}
	}

	.ai-prompt-footer {
		padding: 20px;
		border-top: 1px solid var(--color-gray-8);
		display: flex;
		justify-content: flex-end;
		gap: 10px;

		button {
			padding: 8px 16px;
			border-radius: 4px;
			font-size: 14px;
			font-weight: 500;
			transition: opacity 0.2s;

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		}

		.cancel-btn {
			background: var(--color-gray-8);
			color: var(--color-gray-4);

			&:hover:not(:disabled) {
				background: var(--color-gray-7);
			}
		}

		.generate-btn {
			background: var(--weave-primary-color);
			color: var(--primo-color-codeblack);

			&:hover:not(:disabled) {
				opacity: 0.9;
			}
		}
	}

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
