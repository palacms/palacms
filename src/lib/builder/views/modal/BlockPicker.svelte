<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { LibrarySymbolGroups, LibrarySymbols } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import SymbolButton from '$lib/components/SymbolButton.svelte'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'

	let { onsave } = $props()

	let selected_symbol_group = $state<ObjectOf<typeof LibrarySymbolGroups> | null>(null)

	// Auto-select first group when groups are available
	$effect(() => {
		const groups = LibrarySymbolGroups.list() ?? []
		if (groups.length > 0 && !selected_symbol_group) {
			selected_symbol_group = groups[0]
		}
	})
	const symbols = $derived(selected_symbol_group?.symbols() ?? [])
	const columns = $derived(
		selected_symbol_group
			? [
					symbols.slice(Math.floor((symbols.length / 3) * 2), symbols.length),
					symbols.slice(Math.floor(symbols.length / 3), Math.floor((symbols.length / 3) * 2)),
					symbols.slice(0, Math.floor(symbols.length / 3))
				]
			: []
	)

	let selected: ObjectOf<typeof LibrarySymbols>[] = $state([])
	let checked: string[] = $state([])

	// Loading state for the header button
	let loading = $state(false)

	function include_symbol(symbol: ObjectOf<typeof LibrarySymbols>) {
		if (selected.some((s) => s.id === symbol.id) || checked.includes(symbol.id)) {
			selected = selected.filter((item) => item.id !== symbol.id)
			checked = checked.filter((item) => item !== symbol.id)
		} else {
			selected = [...selected, symbol]
			checked = [...checked, symbol.id]
		}
	}
</script>

<Dialog.Header
	class="mb-2"
	title="Add Library Blocks to Site"
	button={{
		label: `Add ${selected.length} Blocks`,
		onclick: async () => {
			loading = true
			try {
				await onsave(selected)
			} finally {
				loading = false
			}
		},
		disabled: selected.length === 0 || loading,
		loading
	}}
/>

<Sidebar.Provider>
	<Sidebar.Root collapsible="none">
		<Sidebar.Content class="p-2">
			<Sidebar.Menu>
				{#each LibrarySymbolGroups.list() ?? [] as group}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={selected_symbol_group?.id === group.id}>
							{#snippet child({ props })}
								<button {...props} onclick={() => (selected_symbol_group = group)}>{group.name}</button>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Content>
	</Sidebar.Root>
	<Sidebar.Inset>
		<div class="BlockPicker">
			<ul>
				{#each columns[0] as symbol (symbol.id)}
					<li>{@render button(symbol)}</li>
				{/each}
			</ul>
			<ul>
				{#each columns[1] as symbol (symbol.id)}
					<li>{@render button(symbol)}</li>
				{/each}
			</ul>
			<ul>
				{#each columns[2] as symbol (symbol.id)}
					<li>{@render button(symbol)}</li>
				{/each}
			</ul>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

{#snippet button(symbol: ObjectOf<typeof LibrarySymbols>)}
	<SymbolButton onclick={() => include_symbol(symbol)} {symbol}>
		<div class="check" in:fade={{ duration: 100 }}>
			{#if checked.includes(symbol.id)}
				<Icon icon="material-symbols:check" />
			{/if}
		</div>
	</SymbolButton>
{/snippet}

<style lang="postcss">
	.BlockPicker {
		background: #111;
		padding: 1rem;
		height: calc(100vh - 70px);
		overflow: auto;
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.5rem;
	}

	.check {
		height: 1em;
	}
</style>
