<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import BlockPickerPanel from '$lib/components/BlockPickerPanel.svelte'
	import { LibrarySymbolEntries, LibrarySymbolFields, LibrarySymbols } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { marketplace } from '$lib/pocketbase/managers'

	type BlockSource = 'library' | 'marketplace'
	type SelectedBlock = { id: string; source: BlockSource }
	type SelectedSymbol = {
		symbol: ObjectOf<typeof LibrarySymbols>
		fields: ObjectOf<typeof LibrarySymbolFields>[]
		entries: ObjectOf<typeof LibrarySymbolEntries>[]
	}

	let { onsave }: { onsave: (symbols: SelectedSymbol[]) => Promise<void> | void } = $props()

	let selected = $state<SelectedBlock[]>([])
	let loading = $state(false)

	const selected_symbols = $derived(
		selected
			.map(({ id, source }) => {
				const symbol = source === 'library' ? LibrarySymbols.one(id) : LibrarySymbols.from(marketplace).one(id)
				const fields = symbol?.fields()
				const entries = symbol?.entries()
				return symbol && fields && entries ? { symbol, fields, entries } : null
			})
			.filter((symbol) => !!symbol)
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
	icon="lucide:plus-square"
	button={{
		label: `Add ${selected_symbols.length} Blocks`,
		onclick: handleSave,
		disabled: selected_symbols.length === 0 || loading,
		loading
	}}
/>

<BlockPickerPanel bind:selected />
