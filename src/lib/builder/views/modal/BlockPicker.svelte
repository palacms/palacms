<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import BlockPickerPanel from '$lib/components/BlockPickerPanel.svelte'
	import { LibrarySymbols, MarketplaceSymbols } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	type BlockSource = 'library' | 'marketplace'
	type SelectedBlock = { id: string; source: BlockSource }
	type SelectedSymbol = {
		source: BlockSource
		symbol: ObjectOf<typeof LibrarySymbols> | ObjectOf<typeof MarketplaceSymbols>
	}

	let { onsave }: { onsave: (symbols: SelectedSymbol[]) => Promise<void> | void } = $props()

	let selected = $state<SelectedBlock[]>([])
	let loading = $state(false)

	const selected_symbols = $derived(
		selected
			.map(({ id, source }) => {
				const symbol = source === 'library' ? LibrarySymbols.one(id) : MarketplaceSymbols.one(id)
				return symbol ? { source, symbol } : null
			})
			.filter(Boolean) as SelectedSymbol[]
	)

	async function handleSave() {
		loading = true
		try {
			await onsave(selected_symbols)
		} finally {
			loading = false
		}
	}
</script>

<Dialog.Header
	class="mb-2"
	title="Add Blocks to Site"
	button={{
		label: `Add ${selected_symbols.length} Blocks`,
		onclick: handleSave,
		disabled: selected_symbols.length === 0 || loading,
		loading
	}}
/>

<BlockPickerPanel bind:selected={selected} />
