<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import Symbol from '../../components/Site_Symbol.svelte'
	import type { LibrarySymbol as SymbolModel } from '$lib/common/models/LibrarySymbol'
	import { LibrarySymbolGroups } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	let { site, onsave } = $props()

	let selected_symbol_group = $state<ObjectOf<typeof LibrarySymbolGroups> | null>(null)
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

	let selected: SymbolModel[] = $state([])
	let checked: string[] = $state([])

	function include_symbol(symbol: SymbolModel) {
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
		onclick: () => onsave(selected),
		disabled: selected.length === 0
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
					<li>
						<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} />
					</li>
				{/each}
			</ul>
			<ul>
				{#each columns[1] as symbol (symbol.id)}
					<li>
						<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} />
					</li>
				{/each}
			</ul>
			<ul>
				{#each columns[2] as symbol (symbol.id)}
					<li>
						<Symbol checked={checked.includes(symbol.id)} onclick={() => include_symbol(symbol)} {symbol} />
					</li>
				{/each}
			</ul>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

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
</style>
