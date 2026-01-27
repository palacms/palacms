import {
	LibrarySymbolEntries,
	LibrarySymbolFields,
	LibrarySymbols,
	SiteSymbolEntries,
	SiteSymbolFields,
	SiteSymbols
} from '../pocketbase/collections'
import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
import type { Sites } from '../pocketbase/collections'

export const create_site_symbols = ({
	source_symbols,
	site,
	site_symbol_map = new Map()
}: {
	source_symbols: (ObjectOf<typeof SiteSymbols> | ObjectOf<typeof LibrarySymbols>)[]
	site: ObjectOf<typeof Sites>
	site_symbol_map?: Map<string, ObjectOf<typeof SiteSymbols>>
}): Map<string, ObjectOf<typeof SiteSymbols>> => {
	for (const source_symbol of source_symbols) {
		const symbol = SiteSymbols.create({
			...source_symbol.values(),
			id: undefined,
			site: site.id,
			compiled_js: undefined
		})
		site_symbol_map.set(source_symbol.id, symbol)
	}
	return site_symbol_map
}

export const create_site_symbol_fields = ({
	source_symbol_fields,
	source_parent_field,
	site_symbol_field_map = new Map(),
	site_symbol_map
}: {
	source_symbol_fields: (ObjectOf<typeof SiteSymbolFields> | ObjectOf<typeof LibrarySymbolFields>)[]
	source_parent_field?: ObjectOf<typeof SiteSymbolFields> | ObjectOf<typeof LibrarySymbolFields>
	site_symbol_field_map?: Map<string, ObjectOf<typeof SiteSymbolFields>>
	site_symbol_map: Map<string, ObjectOf<typeof SiteSymbols>>
}): Map<string, ObjectOf<typeof SiteSymbolFields>> => {
	for (const source_symbol_field of source_symbol_fields) {
		if (source_parent_field ? source_symbol_field.parent !== source_parent_field.id : source_symbol_field.parent) {
			continue
		}

		const symbol = site_symbol_map.get(source_symbol_field.symbol)
		if (!symbol) {
			throw new Error('No symbol for symbol field')
		}

		const parent = source_symbol_field.parent ? site_symbol_field_map.get(source_symbol_field.parent) : undefined
		if (source_symbol_field.parent && !parent) {
			throw new Error('No parent symbol field')
		}

		const field = SiteSymbolFields.create({
			...source_symbol_field.values(),
			id: undefined,
			symbol: symbol.id,
			parent: parent?.id
		})
		site_symbol_field_map.set(source_symbol_field.id, field)
		create_site_symbol_fields({
			source_symbol_fields,
			source_parent_field: source_symbol_field,
			site_symbol_field_map,
			site_symbol_map
		})
	}
	return site_symbol_field_map
}

export const create_site_symbol_entries = ({
	source_symbol_entries,
	source_parent_entry,
	site_symbol_entry_map = new Map(),
	site_symbol_field_map
}: {
	source_symbol_entries: (ObjectOf<typeof SiteSymbolEntries> | ObjectOf<typeof LibrarySymbolEntries>)[]
	source_parent_entry?: ObjectOf<typeof SiteSymbolEntries> | ObjectOf<typeof LibrarySymbolEntries>
	site_symbol_entry_map?: Map<string, ObjectOf<typeof SiteSymbolEntries>>
	site_symbol_field_map: Map<string, ObjectOf<typeof SiteSymbolFields>>
}): Map<string, ObjectOf<typeof SiteSymbolEntries>> => {
	for (const source_symbol_entry of source_symbol_entries) {
		if (source_parent_entry ? source_symbol_entry.parent !== source_parent_entry.id : source_symbol_entry.parent) {
			continue
		}

		const field = site_symbol_field_map.get(source_symbol_entry.field)
		if (!field) {
			throw new Error('No symbol field for symbol entry')
		}

		const parent = source_symbol_entry.parent ? site_symbol_entry_map.get(source_symbol_entry.parent) : undefined
		if (source_symbol_entry.parent && !parent) {
			throw new Error('No parent symbol entry')
		}

		const entry = SiteSymbolEntries.create({
			...source_symbol_entry.values(),
			id: undefined,
			field: field.id,
			parent: parent?.id,
			value: source_symbol_entry.value
		})
		site_symbol_entry_map.set(source_symbol_entry.id, entry)
		create_site_symbol_entries({
			source_symbol_entries,
			source_parent_entry: source_symbol_entry,
			site_symbol_field_map,
			site_symbol_entry_map
		})
	}
	return site_symbol_entry_map
}
