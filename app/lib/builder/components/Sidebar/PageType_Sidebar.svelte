<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import * as _ from 'lodash-es'
	import { goto } from '$app/navigation'
	import { browser } from '$app/environment'
	import UI from '../../ui/index.js'
	// Icon component removed to prevent stack overflow issues
	import Icon from '@iconify/svelte'
	import BlockEditor from '$lib/builder/views/modal/BlockEditor.svelte'
	import BlockPicker from '$lib/builder/views/modal/BlockPicker.svelte'
	import Sidebar_Symbol from './Sidebar_Symbol.svelte'
	import Fields from '$lib/builder/components/Fields/FieldsContent.svelte'
	import { flip } from 'svelte/animate'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Cuboid, SquarePen } from 'lucide-svelte'
	import { page } from '$app/state'
	import { Sites, PageTypes, SiteSymbols, PageTypeSymbols, SiteSymbolFields, SiteSymbolEntries, PageTypeFields, PageTypeEntries, manager } from '$lib/pocketbase/collections'
	import { site_html } from '$lib/builder/stores/app/page.js'
	import DropZone from '$lib/components/DropZone.svelte'
	import { Button } from '$lib/components/ui/button'
	import { setFieldEntries } from '../Fields/FieldsContent.svelte'
	import { current_user } from '$lib/pocketbase/user.js'
	import { useImportSiteSymbol } from '$lib/ImportSymbol.svelte.js'
	import { tick } from 'svelte'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte.ts'

	const host = $derived(page.url.host)
	const site = $derived(Sites.list({ filter: `host = "${host}"` })?.[0])
	const page_type_id = $derived(page.params.page_type)
	const page_type = $derived(PageTypes.one(page_type_id))
	const fields = $derived(page_type?.fields() ?? [])
	const entries = $derived(page_type?.entries() ?? [])
	const page_type_symbols = $derived(page_type?.symbols() ?? [])
	const site_symbols = $derived(site?.symbols() ?? [])

	// get the query param to set the tab when navigating from page (i.e. 'Manage Fields')
	let active_tab = $state(page.url.searchParams.get('tab') === 'fields' ? 'CONTENT' : 'BLOCKS')
	if (browser) {
		const url = new URL(page.url)
		url.searchParams.delete('tab')
		goto(url, { replaceState: true })
	}

	async function create_block() {
		creating_block = true
	}

	// Import/Export functionality
	let upload_dialog_open = $state(false)
	let upload_file_invalid = $state(false)

	let file = $state<File>()
	const importSiteSymbol = $derived(useImportSiteSymbol(file, site?.id))
	async function upload_block(newFile: File) {
		file = newFile
		await tick()

		if (!file || !site) return
		try {
			console.log('Importing file:', file.name, 'Size:', file.size)
			await importSiteSymbol.run()
			upload_dialog_open = false
			upload_file_invalid = false
			file = undefined
			console.log('Import successful!')
		} catch (error) {
			console.error('Failed to import symbol:', error)
			console.error('Error details:', error.message, error.stack)
			upload_file_invalid = true
			file = undefined
		}
	}

	let active_block_id = $state(null)
	let active_block = $state<ObjectOf<typeof SiteSymbols>>()

	function edit_block(block, block_id) {
		active_block = block
		active_block_id = block_id
		editing_block = true
	}

	async function show_block_picker() {
		adding_block = true
	}

	function drag_target(element, block) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ block },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDrop({ self, source }) {
				if (!site) return
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				const block_dragged_over = self.data.block
				const block_being_dragged = source.data.block
				const block_dragged_over_index = site_symbols.findIndex((symbol) => symbol.id === block_dragged_over.id)
				const target_index = closestEdgeOfTarget === 'top' ? block_dragged_over_index : block_dragged_over_index + 1
				// TODO: reconfigure
				// data.symbols = [
				// 	...data.symbols.slice(0, target_index).filter((symbol) => symbol.id !== block_being_dragged.id),
				// 	block_being_dragged,
				// 	...data.symbols.slice(target_index).filter((symbol) => symbol.id !== block_being_dragged.id)
				// ]
			}
		})
	}

	let editing_block = $state(false)
	let creating_block = $state(false)
	let adding_block = $state(false)
	let static_transition_dialog = $state(false)
	let pending_symbol_toggle = $state<{ relation: any; symbol: any } | null>(null)

	// Handle unsaved changes for block editors
	let editing_block_has_unsaved_changes = $state(false)
	let creating_block_has_unsaved_changes = $state(false)

	let commit_task = $state<NodeJS.Timeout>()
</script>

<Dialog.Root
	bind:open={editing_block}
	onOpenChange={(open) => {
		if (!open) {
			// Check for unsaved changes before closing
			if (editing_block_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					// Prevent closing by reopening the dialog
					editing_block = true
					return
				}
				// User confirmed, discard changes
				manager.discard()
			}
		}
	}}
>
	<Dialog.Content class="z-[999] max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4">
		<BlockEditor
			block={active_block}
			bind:has_unsaved_changes={editing_block_has_unsaved_changes}
			header={{
				title: `Edit ${active_block?.name || 'Block'}`,
				button: {
					label: 'Save',
					onclick: () => {
						editing_block = false
						active_block_id = null
					}
				}
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={creating_block}
	onOpenChange={(open) => {
		if (!open) {
			// Check for unsaved changes before closing
			if (creating_block_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					// Prevent closing by reopening the dialog
					creating_block = true
					return
				}
				// User confirmed, discard changes
				manager.discard()
			}
		}
	}}
>
	<Dialog.Content class="z-[999] max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4">
		<BlockEditor
			bind:has_unsaved_changes={creating_block_has_unsaved_changes}
			header={{
				button: {
					label: 'Create Block',
					onclick: () => {
						creating_block = false
					}
				}
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={adding_block}
	onOpenChange={(open) => {
		if (!open) {
			manager.discard()
		}
	}}
>
	<Dialog.Content class="z-[999] max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4">
		<BlockPicker
			{site}
			onsave={(blocks) => {
				console.log({ blocks })
				// TODO: add blocks to site
				adding_block = false
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<!-- Static Transition Dialog -->
<Dialog.Root bind:open={static_transition_dialog}>
	<Dialog.Content class="sm:max-w-[500px] p-6 pt-12">
		<div class="mb-6">
			<h2 class="text-lg font-semibold mb-2">Page Type Becoming Static</h2>
			<p class="text-sm text-gray-400 leading-relaxed">
				This page type will become static. Existing pages will keep their current sections but you won't be able to add to, remove, or reorder them. New pages will use the current template.
			</p>
		</div>
		<div class="flex gap-2 justify-end">
			<Button
				variant="outline"
				onclick={() => {
					static_transition_dialog = false
					pending_symbol_toggle = null
				}}
			>
				Cancel
			</Button>
			<Button
				onclick={() => {
					if (pending_symbol_toggle) {
						PageTypeSymbols.delete(pending_symbol_toggle.relation.id)
						manager.commit()
					}
					static_transition_dialog = false
					pending_symbol_toggle = null
				}}
			>
				Continue
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<div class="sidebar primo-reset">
	<Tabs.Root value={active_tab === 'CONTENT' ? 'content' : 'blocks'} class="p-2">
		<Tabs.List class="w-full mb-2">
			<Tabs.Trigger value="blocks" class="flex-1 flex gap-1">
				<Cuboid class="w-3" />
				<!-- <span class="text-xs">Page Blocks</span> -->
			</Tabs.Trigger>
			<Tabs.Trigger value="content" class="flex-1 flex gap-1">
				<SquarePen class="w-3" />
				<!-- <span class="text-xs">Page Content</span> -->
			</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="blocks" class="px-1">
			{#if site_symbols.length > 0}
				{#if $current_user?.siteRole === 'developer'}
					<div class="primo-buttons">
						<button class="primo-button" onclick={show_block_picker}>
							<Icon icon="mdi:plus" />
							<span>Add</span>
						</button>
						{#if $current_user?.siteRole === 'developer'}
							<button class="primo-button" onclick={create_block}>
								<Icon icon="mdi:code" />
								<span>Create</span>
							</button>
							<button class="primo-button" onclick={() => (upload_dialog_open = true)}>
								<Icon icon="mdi:upload" />
								<span>Import</span>
							</button>
						{/if}
					</div>
				{/if}
				{#if $site_html !== null}
					<div class="block-list">
						{#each site_symbols as symbol (symbol.id)}
							{@const relation = page_type_symbols.find((relation) => relation.symbol === symbol.id)}
							{@const toggled = !!relation}
							<div class="block" animate:flip={{ duration: 200 }} use:drag_target={symbol}>
								<Sidebar_Symbol
									{symbol}
									head={$site_html}
									show_toggle={true}
									{toggled}
									on:toggle={({ detail }) => {
										if (!page_type || detail === toggled) return // dispatches on creation for some reason

										// Check if this toggle would make the page type static
										const current_symbol_count = page_type_symbols.length
										const will_be_static = toggled && current_symbol_count === 1 // removing last symbol

										if (toggled) {
											// Show dialog before making static
											if (will_be_static) {
												pending_symbol_toggle = { relation, symbol }
												static_transition_dialog = true
											} else {
												PageTypeSymbols.delete(relation.id)
												manager.commit()
											}
										} else {
											PageTypeSymbols.create({ page_type: page_type.id, symbol: symbol.id })
											manager.commit()
										}
									}}
									on:edit={() => edit_block(symbol, symbol.id)}
									on:delete={() => {
										SiteSymbols.delete(symbol.id)
										manager.commit()
									}}
									controls_enabled={$current_user?.siteRole === 'developer'}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<div style="display: flex;justify-content: center;font-size: 2rem;color:var(--color-gray-6)">
						<UI.Spinner variant="loop" />
					</div>
				{/if}
			{:else}
				<div class="empty">Add a Block to your site to use it on your pages.</div>
				<div class="primo-buttons">
					<button class="primo-button" onclick={show_block_picker}>
						<Icon icon="mdi:plus" />
						<span>Add</span>
					</button>
					<button class="primo-button" onclick={create_block}>
						<Icon icon="mdi:code" />
						<span>Create</span>
					</button>
					<button class="primo-button" onclick={() => (upload_dialog_open = true)}>
						<Icon icon="mdi:upload" />
						<span>Import</span>
					</button>
				</div>
			{/if}
		</Tabs.Content>
		<Tabs.Content value="content" class="px-1">
			<div class="page-type-fields">
				{#if page_type}
					<Fields
						entity={page_type}
						{fields}
						{entries}
						create_field={async (data) => {
							// Get the highest index for fields at this level
							const siblingFields = (fields ?? []).filter((f) => (data?.parent ? f.parent === data.parent : !f.parent))
							const nextIndex = Math.max(...siblingFields.map((f) => f.index || 0), -1) + 1

							return PageTypeFields.create({
								type: 'text',
								key: '',
								label: '',
								config: null,
								page_type: page_type.id,
								...data,
								index: nextIndex
							})
						}}
						oninput={(values) => {
							setFieldEntries({
								fields,
								entries,
								updateEntry: PageTypeEntries.update,
								createEntry: PageTypeEntries.create,
								values
							})
							clearTimeout(commit_task)
							commit_task = setTimeout(() => manager.commit(), 500)
						}}
						onchange={({ id, data }) => {
							PageTypeFields.update(id, data)
						}}
						ondelete={(field_id) => {
							// PocketBase cascade deletion will automatically clean up all associated entries
							PageTypeFields.delete(field_id)
						}}
						onadd={({ parent, index, subfields }) => {
							// Create an entry for the repeater item
							PageTypeEntries.create({
								field: parent,
								locale: 'en',
								value: {}
							})
						}}
					/>
				{/if}
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Import Symbol Dialog -->
<Dialog.Root bind:open={upload_dialog_open}>
	<Dialog.Content class="sm:max-w-[500px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Import Block</h2>
		<p class="text-muted-foreground text-sm mb-4">Import a block from a JSON file exported from another site.</p>

		<DropZone onupload={upload_block} invalid={upload_file_invalid} drop_text="Drop your block file here or click to browse" accept=".json" class="mb-4" />

		<Dialog.Footer>
			<Button
				type="button"
				variant="outline"
				onclick={() => {
					upload_dialog_open = false
					upload_file_invalid = false
				}}
			>
				Cancel
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style lang="postcss">
	.sidebar {
		width: 100%;
		background: #111;
		z-index: 9;
		display: flex;
		flex-direction: column;
		height: calc(100vh - 59px);
		/* height: 100%; */
		/* gap: 0.5rem; */
		z-index: 9;
		position: relative;
		overflow: auto;
		/* overflow: hidden; */
		/* padding-top: 0.5rem; */
	}

	.empty {
		font-size: 0.75rem;
		color: var(--color-gray-2);
		padding-bottom: 0.25rem;
	}

	.primo-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.primo-button {
		padding: 0.25rem 0.5rem;
		/* color: #b6b6b6;
			background: #292929; */
		color: var(--color-gray-2);
		background: var(--color-gray-8);
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		gap: 0.25rem;
		align-items: center;
		font-size: 0.75rem;

		input {
			display: none;
		}
	}

	.container {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 1rem;
		gap: 0.75rem;
	}

	.block-list {
		/* gap: 1rem; */
		flex: 1;
		display: flex;
		flex-direction: column;

		.block {
			padding-block: 0.5rem;
		}

		.block:first-child {
			padding-top: 0;
		}
	}
</style>
