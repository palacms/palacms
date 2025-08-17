<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Dialog from '$lib/components/ui/dialog'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'
	import { Input } from '$lib/components/ui/input'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { Label } from '$lib/components/ui/label'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import DropZone from '$lib/components/DropZone.svelte'
	import { CirclePlus, Cuboid, Code, Upload, Download, SquarePen, Trash2, ChevronDown, Loader, EllipsisVertical, ArrowLeftRight } from 'lucide-svelte'
	import SymbolButton from '$lib/components/SymbolButton.svelte'
	import { page } from '$app/state'
	import { goto } from '$app/navigation'
	import { useSidebar } from '$lib/components/ui/sidebar'
	import { LibrarySymbolGroups, LibrarySymbols, LibrarySymbolFields, LibrarySymbolEntries, manager, SiteSymbols } from '$lib/pocketbase/collections'
	import type { LibrarySymbol } from '$lib/common/models/LibrarySymbol'
	import { useImportLibrarySymbol } from '$lib/ImportSymbol.svelte'
	import { tick } from 'svelte'
	import { BlockEditor } from '$lib/builder/views/modal'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { useExportLibrarySymbol } from '$lib/ExportSymbol.svelte'

	const active_symbol_group_id = $derived(page.url.searchParams.get('group'))
	const active_symbol_group = $derived(active_symbol_group_id ? LibrarySymbolGroups.one(active_symbol_group_id) : undefined)
	const symbol_groups = $derived(LibrarySymbolGroups.list() ?? [])

	// Get symbols for the active group using direct query instead of relationship method
	const group_symbols = $derived(active_symbol_group?.symbols() ?? [])

	const sidebar = useSidebar()

	let creating_block = $state(false)

	function open_create_block() {
		creating_block = true
	}

	let file = $state<File>()
	const importLibrarySymbol = $derived(useImportLibrarySymbol(file, active_symbol_group_id ?? undefined))
	async function upload_block_file(newFile) {
		file = newFile
		await tick()

		if (!file) return
		if (!active_symbol_group_id) {
			console.error('No active symbol group selected')
			return
		}

		try {
			await importLibrarySymbol.run()
			upload_dialog_open = false
			upload_file_invalid = false
			file = undefined
		} catch (error) {
			console.error('Failed to import symbol:', error)

			// Show more detailed error message
			if (error.response?.data) {
				console.error('PocketBase error details:', error.response.data)
			}

			upload_file_invalid = true
			file = undefined
		}
	}

	let is_rename_open = $state(false)
	let new_name = $state('')
	$effect(() => {
		if (active_symbol_group) {
			new_name = active_symbol_group.name
		}
	})
	async function handle_rename(e) {
		e.preventDefault()
		if (!active_symbol_group_id) return
		LibrarySymbolGroups.update(active_symbol_group_id, { name: new_name })
		await manager.commit()
		is_rename_open = false
	}

	let is_delete_open = $state(false)
	let deleting = $state(false)

	// Upload dialog state
	let upload_dialog_open = $state(false)
	let upload_file_invalid = $state(false)

	// Export symbol
	let symbol_to_export = $state<ObjectOf<typeof SiteSymbols>>()
	const exportSymbol = $derived(useExportLibrarySymbol(symbol_to_export?.id))
	async function export_symbol(symbol: ObjectOf<typeof SiteSymbols>) {
		symbol_to_export = symbol
		await tick()
		await exportSymbol.run()
	}

	async function handle_delete() {
		deleting = true
		if (!active_symbol_group_id) return
		LibrarySymbolGroups.delete(active_symbol_group_id)
		await manager.commit()
		await goto('/admin/dashboard/library')
		deleting = false
		is_delete_open = false
	}

	let symbol_being_edited = $state<ObjectOf<typeof LibrarySymbols>>()
	let is_symbol_editor_open = $state(false)

	function begin_symbol_edit(symbol: ObjectOf<typeof LibrarySymbols>) {
		symbol_being_edited = symbol
		is_symbol_editor_open = true
	}

	// Symbol rename
	let symbol_being_renamed: LibrarySymbol | null = $state(null)
	let is_symbol_renamer_open = $state(false)

	function begin_symbol_rename(symbol: LibrarySymbol) {
		symbol_being_renamed = symbol
		new_name = symbol.name
		is_symbol_renamer_open = true
	}

	async function handle_symbol_rename(e) {
		e.preventDefault()
		if (!symbol_being_renamed) return
		LibrarySymbols.update(symbol_being_renamed.id, { name: new_name })
		await manager.commit()
		is_symbol_renamer_open = false
		symbol_being_renamed = null
	}

	// Symbol move
	let symbol_being_moved: LibrarySymbol | null = $state(null)
	let is_symbol_move_open = $state(false)
	let selected_group_id = $state('')

	function begin_symbol_move(symbol: LibrarySymbol) {
		symbol_being_moved = symbol
		const original_group_id = symbol.group
		selected_group_id = original_group_id ?? ''
		is_symbol_move_open = true
	}

	async function move_symbol() {
		if (!symbol_being_moved) return
		LibrarySymbols.update(symbol_being_moved.id, { group: selected_group_id })
		await manager.commit()
		is_symbol_move_open = false
		symbol_being_moved = null
	}

	// Symbol delete
	let symbol_being_deleted: LibrarySymbol | null = $state(null)
	let is_delete_symbol_open = $state(false)

	function begin_symbol_delete(symbol: LibrarySymbol) {
		symbol_being_deleted = symbol
		is_delete_symbol_open = true
	}

	async function delete_library_symbol() {
		if (!symbol_being_deleted) return
		deleting = true
		LibrarySymbols.delete(symbol_being_deleted.id)
		await manager.commit()
		is_delete_symbol_open = false
		symbol_being_deleted = null
		deleting = false
	}

	let creating_block_has_unsaved_changes = $state(false)
	let editing_block_has_unsaved_changes = $state(false)
</script>

<!-- Symbol Group Dialogs -->
<Dialog.Root bind:open={is_rename_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename group</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your group</p>
		<form onsubmit={handle_rename}>
			<Input bind:value={new_name} placeholder="Enter new group name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_rename_open = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={is_delete_open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete <strong>{active_symbol_group?.name}</strong>
				and
				<strong>all</strong>
				it's blocks.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handle_delete} class="bg-red-600 hover:bg-red-700">
				{#if deleting}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {active_symbol_group?.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">{active_symbol_group?.name}</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button {...props}>
						<ChevronDown class="h-4" />
						<span class="sr-only">More</span>
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56 rounded-lg" side="bottom" align={sidebar.isMobile ? 'end' : 'start'}>
				<DropdownMenu.Item onclick={() => (is_rename_open = true)}>
					<SquarePen class="text-muted-foreground" />
					<span>Rename</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => (is_delete_open = true)}>
					<Trash2 class="text-muted-foreground" />
					<span>Delete</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<div class="ml-auto mr-4 flex gap-2">
		{#if active_symbol_group_id}
			<Button size="sm" variant="outline" onclick={open_create_block}>
				<CirclePlus class="h-4 w-4" />
				Create Block
			</Button>
			<Button size="sm" variant="outline" onclick={() => (upload_dialog_open = true)}>
				<Upload class="h-4 w-4" />
				Import Block
			</Button>
		{/if}
	</div>
</header>

<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if group_symbols.length}
		<div class="masonry">
			<ul>
				{#each group_symbols as symbol (symbol.id)}
					<li>
						<SymbolButton {symbol} onclick={() => begin_symbol_edit(symbol)}>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									<EllipsisVertical size={14} />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content>
									<DropdownMenu.Item onclick={() => begin_symbol_edit(symbol)}>
										<Code class="h-4 w-4" />
										<span>Edit</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => export_symbol(symbol)}>
										<Download class="h-4 w-4" />
										<span>Export</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => begin_symbol_move(symbol)}>
										<ArrowLeftRight class="h-4 w-4" />
										<span>Move</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => begin_symbol_rename(symbol)}>
										<SquarePen class="h-4 w-4" />
										<span>Rename</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item onclick={() => begin_symbol_delete(symbol)} class="text-red-500 hover:text-red-600 focus:text-red-600">
										<Trash2 class="h-4 w-4" />
										<span>Delete</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</SymbolButton>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<EmptyState icon={Cuboid} title="No Blocks to display" description="Blocks are components you can add to any site. When you create one it'll show up here." />
	{/if}
</div>

<!-- Symbol Dialogs -->
<Dialog.Root bind:open={is_symbol_move_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="font-medium leading-none">Move to group</h4>
				<p class="text-muted-foreground text-sm">Select a group for this block</p>
			</div>
			<RadioGroup.Root bind:value={selected_group_id}>
				{#each symbol_groups ?? [] as group}
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value={group.id} id={group.id} />
						<Label for={group.id}>{group.name}</Label>
					</div>
				{/each}
			</RadioGroup.Root>
			<div class="flex justify-end">
				<Button onclick={move_symbol}>Move</Button>
			</div>
		</div>
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
	<Dialog.Content escapeKeydownBehavior="ignore" class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4 gap-0">
		<BlockEditor
			symbol_type="library"
			bind:has_unsaved_changes={creating_block_has_unsaved_changes}
			header={{
				title: `New Block`,
				button: {
					label: 'Save',
					onclick: () => {
						creating_block = false
					}
				}
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={is_symbol_editor_open}
	onOpenChange={(open) => {
		if (!open) {
			// Check for unsaved changes before closing
			if (editing_block_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					// Prevent closing by reopening the dialog
					is_symbol_editor_open = true
					return
				}
				// User confirmed, discard changes
				manager.discard()
			}
		}
	}}
>
	<Dialog.Content escapeKeydownBehavior="ignore" class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4 gap-0">
		<BlockEditor
			block={symbol_being_edited}
			symbol_type="library"
			bind:has_unsaved_changes={editing_block_has_unsaved_changes}
			header={{
				title: `Edit ${symbol_being_edited?.name || 'Block'}`,
				button: {
					label: 'Save',
					onclick: () => {
						is_symbol_editor_open = false
						symbol_being_edited = undefined
					}
				}
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_symbol_renamer_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename Block</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your Block</p>
		<form onsubmit={handle_symbol_rename}>
			<Input bind:value={new_name} placeholder="Enter new Block name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_symbol_renamer_open = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={is_delete_symbol_open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete <strong>{symbol_being_deleted?.name}</strong>
				and remove all associated data.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={delete_library_symbol} class="bg-red-600 hover:bg-red-700">
				{#if deleting}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {symbol_being_deleted?.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Upload Symbol Dialog -->
<Dialog.Root bind:open={upload_dialog_open}>
	<Dialog.Content class="sm:max-w-[500px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Import Block</h2>
		<p class="text-muted-foreground text-sm mb-4">Import a block from a JSON file exported from another site.</p>

		<DropZone onupload={upload_block_file} invalid={upload_file_invalid} drop_text="Drop your block file here or click to browse" accept=".json" class="mb-4" />

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
	.masonry {
		display: grid;
		gap: 1rem;
		/* grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); */
		grid-template-columns: 1fr 1fr;

		@media (min-width: 700px) {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
