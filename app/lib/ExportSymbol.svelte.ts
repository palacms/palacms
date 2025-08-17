import { LibrarySymbols, SiteSymbols } from './pocketbase/collections'
import { useSvelteWorker } from './Worker.svelte'

const createExportWorker = (collections: { Symbols: typeof SiteSymbols | typeof LibrarySymbols }) => (symbol_id?: string) => {
	const worker = useSvelteWorker(
		() => !!symbol_id,
		() => !!symbol && !!fields && !!entries,
		async () => {
			const symbolData = {
				...symbol?.values(),
				fields: fields?.map((field) => field.values()) ?? [],
				entries: entries?.map((entry) => entry.values()) ?? []
			}

			const blob = new Blob([JSON.stringify(symbolData, null, 2)], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${symbol?.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		}
	)
	const shouldLoad = $derived(['loading', 'working'].includes(worker.status))
	const symbol = $derived(shouldLoad && symbol_id ? collections.Symbols.one(symbol_id) : undefined)
	const fields = $derived(shouldLoad && symbol ? ('site' in symbol ? symbol?.fields() : symbol?.fields()) : undefined)
	const entries = $derived(shouldLoad && symbol ? ('site' in symbol ? symbol?.entries() : symbol?.entries()) : undefined)
	return worker
}

export const useExportSiteSymbol = createExportWorker({ Symbols: SiteSymbols })
export const useExportLibrarySymbol = createExportWorker({ Symbols: LibrarySymbols })
