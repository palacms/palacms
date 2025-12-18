import { usePageData } from '../PageData.svelte'
import {
	LibrarySymbolEntries,
	LibrarySymbolFields,
	LibrarySymbols,
	PageEntries,
	Pages,
	PageSectionEntries,
	PageSections,
	PageTypeEntries,
	PageTypeFields,
	PageTypes,
	PageTypeSectionEntries,
	PageTypeSections,
	PageTypeSymbols,
	SiteEntries,
	SiteFields,
	Sites,
	SiteSymbolEntries,
	SiteSymbolFields,
	SiteSymbols,
	SiteUploads
} from '../pocketbase/collections'
import type { Field } from '../common/models/Field'
import { useSvelteWorker } from './Worker.svelte'
import type { Entry } from '$lib/common/models/Entry'
import type { CollectionMapping, MappedObject, ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
import { self } from '$lib/pocketbase/managers'
import type { CollectionManager } from '$lib/pocketbase/CollectionManager'

export const useCloneSite = ({
	source_manager = self,
	source_site_id,
	site_name,
	site_host,
	site_group_id
}: {
	source_manager?: CollectionManager
	source_site_id?: string
	site_name?: string
	site_host?: string
	site_group_id?: string
}) => {
	const worker = useSvelteWorker(
		() => !!source_site_id || !!site_name || !site_host || !site_group_id,
		() => !!source_site && !!source_site_pages && !!source_site_data.data,
		async () => {
			const { data } = source_site_data
			if (!data || !source_site || !site_name || !site_host || !site_group_id) {
				throw new Error('Not loaded')
			}

			const site = create_site({ source_site, site_name, site_host, site_group_id })
			const site_upload_map = await create_site_uploads({ source_site_uploads: data.site_uploads, site })
			const site_field_map = create_site_fields({ source_site_fields: data.site_fields, site })
			const site_entry_map = create_site_entries({ source_site_entries: data.site_entries, site_field_map })
			const site_symbol_map = create_site_symbols({ source_symbols: data.symbols, site })
			const site_symbol_field_map = create_site_symbol_fields({ source_symbol_fields: data.symbol_fields, site_symbol_map })
			const site_symbol_entry_map = create_site_symbol_entries({ source_symbol_entries: data.symbol_entries, site_symbol_field_map })
			const page_type_map = create_page_types({ source_page_types: data.page_types, site })
			const page_type_field_map = create_page_type_fields({ source_page_type_fields: data.page_type_fields, page_type_map })
			const page_type_entry_map = create_page_type_entries({ source_page_type_entries: data.page_type_entries, page_type_field_map })
			const page_type_symbol_map = create_page_type_symbols({ source_page_type_symbols: data.page_type_symbols, page_type_map, site_symbol_map })
			const page_type_section_map = create_page_type_sections({ source_page_type_sections: data.page_type_sections, page_type_map, site_symbol_map })
			const page_type_section_entry_map = create_page_type_section_entries({ source_page_type_section_entries: data.page_type_section_entries, page_type_section_map, site_symbol_field_map })
			const page_map = create_pages({ source_pages: data.pages, site, page_type_map })
			const page_entry_map = create_page_entries({ source_page_entries: data.page_entries, page_map, page_type_field_map })
			const page_section_map = create_page_sections({ source_page_sections: data.page_sections, page_map, site_symbol_map })
			const page_section_entry_map = create_page_section_entries({ source_page_section_entries: data.page_section_entries, page_section_map, site_symbol_field_map })

			update_field_config_references({ field_collection: SiteFields, field_map: site_field_map, page_type_field_map, page_type_map, site_field_map })
			update_field_config_references({ field_collection: SiteSymbolFields, field_map: site_symbol_field_map, page_type_field_map, page_type_map, site_field_map })
			update_field_config_references({ field_collection: PageTypeFields, field_map: page_type_field_map, page_type_field_map, page_type_map, site_field_map })

			update_entry_value_references({ entry_collection: SiteEntries, entry_map: site_entry_map, field_map: site_field_map, page_map, site_upload_map })
			update_entry_value_references({ entry_collection: SiteSymbolEntries, entry_map: site_symbol_entry_map, field_map: site_symbol_field_map, page_map, site_upload_map })
			update_entry_value_references({ entry_collection: PageTypeEntries, entry_map: page_type_entry_map, field_map: page_type_field_map, page_map, site_upload_map })
			update_entry_value_references({ entry_collection: PageTypeSectionEntries, entry_map: page_type_section_entry_map, field_map: site_symbol_field_map, page_map, site_upload_map })
			update_entry_value_references({ entry_collection: PageEntries, entry_map: page_entry_map, field_map: page_type_field_map, page_map, site_upload_map })
			update_entry_value_references({ entry_collection: PageSectionEntries, entry_map: page_section_entry_map, field_map: site_symbol_field_map, page_map, site_upload_map })

			await self.commit()
		}
	)

	const shouldLoad = $derived(['loading', 'working'].includes(worker.status))
	const source_site = $derived(shouldLoad && source_site_id ? Sites.from(source_manager).one(source_site_id) : undefined)
	const source_site_pages = $derived(shouldLoad && source_site ? source_site.pages() : undefined)
	const source_site_data = $derived(shouldLoad && source_site && source_site_pages ? usePageData(source_site, source_site_pages, source_manager) : { data: undefined })

	return worker
}

export const create_site = ({
	source_site,
	site_name,
	site_host,
	site_group_id
}: {
	source_site: ObjectOf<typeof Sites>
	site_name: string
	site_host: string
	site_group_id: string
}): ObjectOf<typeof Sites> => {
	const site = Sites.create({
		...source_site.values(),
		id: undefined,
		name: site_name,
		description: '',
		host: site_host,
		group: site_group_id,
		index: 0,
		preview: undefined
	})
	return site
}

export const create_site_uploads = async ({
	source_site_uploads,
	site_upload_map = new Map(),
	site
}: {
	source_site_uploads: ObjectOf<typeof SiteUploads>[]
	site_upload_map?: Map<string, ObjectOf<typeof SiteUploads>>
	site: ObjectOf<typeof Sites>
}): Promise<Map<string, ObjectOf<typeof SiteUploads>>> => {
	for (const source_upload of source_site_uploads) {
		const file =
			typeof source_upload.file === 'string'
				? await fetch(`${source_upload.collection.manager.instance?.baseURL}/api/files/site_uploads/${source_upload.id}/${source_upload.file}`)
					.then((res) => res.blob())
					.then((blob) => new File([blob], source_upload.file.toString()))
				: source_upload.file

		const upload = SiteUploads.create({
			...source_upload.values(),
			id: undefined,
			file,
			site: site.id
		})
		site_upload_map.set(source_upload.id, upload)
	}
	return site_upload_map
}

export const create_site_fields = ({
	source_site_fields,
	source_parent_field,
	site,
	site_field_map = new Map()
}: {
	source_site_fields: ObjectOf<typeof SiteFields>[]
	source_parent_field?: ObjectOf<typeof SiteFields>
	site: ObjectOf<typeof Sites>
	site_field_map?: Map<string, ObjectOf<typeof SiteFields>>
}): Map<string, ObjectOf<typeof SiteFields>> => {
	for (const source_site_field of source_site_fields) {
		if (source_parent_field ? source_site_field.parent !== source_parent_field.id : source_site_field.parent) {
			continue
		}

		const parent = source_site_field.parent ? site_field_map.get(source_site_field.parent) : undefined
		if (source_site_field.parent && !parent) {
			throw new Error('No parent site field')
		}

		const field = SiteFields.create({
			...source_site_field.values(),
			id: undefined,
			site: site.id,
			parent: parent?.id
		})
		site_field_map.set(source_site_field.id, field)
		create_site_fields({
			source_site_fields,
			source_parent_field: source_site_field,
			site,
			site_field_map
		})
	}
	return site_field_map
}

export const create_site_entries = ({
	source_site_entries,
	source_parent_entry,
	site_entry_map = new Map(),
	site_field_map
}: {
	source_site_entries: ObjectOf<typeof SiteEntries>[]
	source_parent_entry?: ObjectOf<typeof SiteEntries>
	site_entry_map?: Map<string, ObjectOf<typeof SiteEntries>>
	site_field_map: Map<string, ObjectOf<typeof SiteFields>>
}): Map<string, ObjectOf<typeof SiteEntries>> => {
	for (const source_site_entry of source_site_entries) {
		if (source_parent_entry ? source_site_entry.parent !== source_parent_entry.id : source_site_entry.parent) {
			continue
		}

		const field = site_field_map.get(source_site_entry.field)
		if (!field) {
			throw new Error('No site field for site entry')
		}

		const parent = source_site_entry.parent ? site_entry_map.get(source_site_entry.parent) : undefined
		if (source_site_entry.parent && !parent) {
			throw new Error('No parent site entry')
		}

		const entry = SiteEntries.create({
			...source_site_entry.values(),
			id: undefined,
			field: field.id,
			parent: parent?.id,
			value: source_site_entry.value
		})
		site_entry_map.set(source_site_entry.id, entry)
		create_site_entries({
			source_site_entries,
			source_parent_entry: source_site_entry,
			site_entry_map,
			site_field_map
		})
	}
	return site_entry_map
}

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

export const create_page_types = ({
	source_page_types,
	site,
	page_type_map = new Map()
}: {
	source_page_types: ObjectOf<typeof PageTypes>[]
	site: ObjectOf<typeof Sites>
	page_type_map?: Map<string, ObjectOf<typeof PageTypes>>
}): Map<string, ObjectOf<typeof PageTypes>> => {
	for (const source_page_type of source_page_types) {
		const page_type = PageTypes.create({
			...source_page_type.values(),
			id: undefined,
			site: site.id
		})
		page_type_map.set(source_page_type.id, page_type)
	}
	return page_type_map
}

export const create_page_type_fields = ({
	source_page_type_fields,
	source_parent_field,
	page_type_field_map = new Map(),
	page_type_map
}: {
	source_page_type_fields: ObjectOf<typeof PageTypeFields>[]
	source_parent_field?: ObjectOf<typeof PageTypeFields>
	page_type_field_map?: Map<string, ObjectOf<typeof PageTypeFields>>
	page_type_map: Map<string, ObjectOf<typeof PageTypes>>
}): Map<string, ObjectOf<typeof PageTypeFields>> => {
	for (const source_page_type_field of source_page_type_fields) {
		if (source_parent_field ? source_page_type_field.parent !== source_parent_field.id : source_page_type_field.parent) {
			continue
		}

		const page_type = page_type_map.get(source_page_type_field.page_type)
		if (!page_type) {
			throw new Error('No page type for page type field')
		}

		const parent = source_page_type_field.parent ? page_type_field_map.get(source_page_type_field.parent) : undefined
		if (source_page_type_field.parent && !parent) {
			throw new Error('No parent page type field')
		}

		const field = PageTypeFields.create({
			...source_page_type_field.values(),
			id: undefined,
			page_type: page_type.id,
			parent: parent?.id
		})
		page_type_field_map.set(source_page_type_field.id, field)
		create_page_type_fields({
			source_page_type_fields,
			source_parent_field: source_page_type_field,
			page_type_field_map,
			page_type_map
		})
	}
	return page_type_field_map
}

export const create_page_type_entries = ({
	source_page_type_entries,
	source_parent_entry,
	page_type_entry_map = new Map(),
	page_type_field_map
}: {
	source_page_type_entries: ObjectOf<typeof PageTypeEntries>[]
	source_parent_entry?: ObjectOf<typeof PageTypeEntries>
	page_type_entry_map?: Map<string, ObjectOf<typeof PageTypeEntries>>
	page_type_field_map: Map<string, ObjectOf<typeof PageTypeFields>>
}): Map<string, ObjectOf<typeof PageTypeEntries>> => {
	for (const source_page_type_entry of source_page_type_entries) {
		if (source_parent_entry ? source_page_type_entry.parent !== source_parent_entry.id : source_page_type_entry.parent) {
			continue
		}

		const field = page_type_field_map.get(source_page_type_entry.field)
		if (!field) {
			throw new Error('No page type field for page type entry')
		}

		const parent = source_page_type_entry.parent ? page_type_entry_map.get(source_page_type_entry.parent) : undefined
		if (source_page_type_entry.parent && !parent) {
			throw new Error('No parent page type entry')
		}

		const entry = PageTypeEntries.create({
			...source_page_type_entry.values(),
			id: undefined,
			field: field.id,
			parent: parent?.id,
			value: source_page_type_entry.value
		})
		page_type_entry_map.set(source_page_type_entry.id, entry)
		create_page_type_entries({
			source_page_type_entries,
			source_parent_entry: source_page_type_entry,
			page_type_entry_map,
			page_type_field_map
		})
	}
	return page_type_entry_map
}

export const create_page_type_symbols = ({
	source_page_type_symbols,
	page_type_symbol_map = new Map(),
	page_type_map,
	site_symbol_map
}: {
	source_page_type_symbols: ObjectOf<typeof PageTypeSymbols>[]
	page_type_symbol_map?: Map<string, ObjectOf<typeof PageTypeSymbols>>
	page_type_map: Map<string, ObjectOf<typeof PageTypes>>
	site_symbol_map: Map<string, ObjectOf<typeof SiteSymbols>>
}): Map<string, ObjectOf<typeof PageTypeSymbols>> => {
	for (const source_page_type_symbol of source_page_type_symbols) {
		const page_type = page_type_map.get(source_page_type_symbol.page_type)
		if (!page_type) {
			throw new Error('No page type for page type symbol')
		}

		const site_symbol = site_symbol_map.get(source_page_type_symbol.symbol)
		if (!site_symbol) {
			// Symbol wasn't cloned (orphaned reference or not loaded), skip this association
			// Happens when a symbol belongs to a site but isn't used on any sections
			// TODO: enable cloning site symbols without section instances
			continue
		}

		PageTypeSymbols.create({
			...source_page_type_symbol.values(),
			id: undefined,
			page_type: page_type.id,
			symbol: site_symbol.id
		})
	}
	return page_type_symbol_map
}

const create_page_type_sections = ({
	source_page_type_sections,
	page_type_section_map = new Map(),
	page_type_map,
	site_symbol_map
}: {
	source_page_type_sections: ObjectOf<typeof PageTypeSections>[]
	page_type_section_map?: Map<string, ObjectOf<typeof PageTypeSections>>
	page_type_map: Map<string, ObjectOf<typeof PageTypes>>
	site_symbol_map: Map<string, ObjectOf<typeof SiteSymbols>>
}): Map<string, ObjectOf<typeof PageTypeSections>> => {
	for (const source_page_type_section of source_page_type_sections) {
		const page_type = page_type_map.get(source_page_type_section.page_type)
		if (!page_type) {
			throw new Error('No page type for page type section')
		}

		const site_symbol = site_symbol_map.get(source_page_type_section.symbol)
		if (!site_symbol) {
			throw new Error('No site symbol for page type section')
		}

		const section = PageTypeSections.create({
			...source_page_type_section.values(),
			id: undefined,
			page_type: page_type.id,
			symbol: site_symbol.id
		})
		page_type_section_map.set(source_page_type_section.id, section)
	}
	return page_type_section_map
}

export const create_page_type_section_entries = ({
	source_page_type_section_entries,
	source_parent_entry,
	page_type_section_entry_map = new Map(),
	page_type_section_map,
	site_symbol_field_map
}: {
	source_page_type_section_entries: ObjectOf<typeof PageTypeSectionEntries>[]
	source_parent_entry?: ObjectOf<typeof PageTypeSectionEntries>
	page_type_section_entry_map?: Map<string, ObjectOf<typeof PageTypeSectionEntries>>
	page_type_section_map: Map<string, ObjectOf<typeof PageTypeSections>>
	site_symbol_field_map: Map<string, ObjectOf<typeof SiteSymbolFields>>
}) => {
	for (const source_page_type_section_entry of source_page_type_section_entries) {
		if (source_parent_entry ? source_page_type_section_entry.parent !== source_parent_entry.id : source_page_type_section_entry.parent) {
			continue
		}

		const section = page_type_section_map.get(source_page_type_section_entry.section)
		if (!section) {
			throw new Error('No page type section for page type section entry')
		}

		const field = site_symbol_field_map.get(source_page_type_section_entry.field)
		if (!field) {
			throw new Error('No site symbol field for page type section entry')
		}

		const parent = source_page_type_section_entry.parent ? page_type_section_entry_map.get(source_page_type_section_entry.parent) : undefined
		if (source_page_type_section_entry.parent && !parent) {
			throw new Error('No parent page type section entry')
		}

		const entry = PageTypeSectionEntries.create({
			...source_page_type_section_entry.values(),
			id: undefined,
			section: section.id,
			field: field.id,
			parent: parent?.id,
			value: source_page_type_section_entry.value
		})
		page_type_section_entry_map.set(source_page_type_section_entry.id, entry)
		create_page_type_section_entries({
			source_page_type_section_entries,
			source_parent_entry: source_page_type_section_entry,
			page_type_section_entry_map,
			page_type_section_map,
			site_symbol_field_map
		})
	}
	return page_type_section_entry_map
}

export const create_pages = ({
	source_pages,
	source_parent_page,
	site,
	page_map = new Map(),
	page_type_map
}: {
	source_pages: ObjectOf<typeof Pages>[]
	source_parent_page?: ObjectOf<typeof Pages>
	site: ObjectOf<typeof Sites>
	page_map?: Map<string, ObjectOf<typeof Pages>>
	page_type_map: Map<string, ObjectOf<typeof PageTypes>>
}): Map<string, ObjectOf<typeof Pages>> => {
	for (const source_page of source_pages) {
		if (source_parent_page ? source_page.parent !== source_parent_page.id : source_page.parent) {
			continue
		}

		const page_type = page_type_map.get(source_page.page_type)
		if (!page_type) {
			throw new Error('No page type for page')
		}

		const parent = source_page.parent ? page_map.get(source_page.parent) : undefined
		if (source_page.parent && !parent) {
			throw new Error('No parent page')
		}

		const page = Pages.create({
			...source_page.values(),
			id: undefined,
			site: site.id,
			page_type: page_type.id,
			parent: parent?.id ?? '',
			compiled_html: undefined
		})
		page_map.set(source_page.id, page)
		create_pages({
			source_pages,
			source_parent_page: source_page,
			site,
			page_map,
			page_type_map
		})
	}
	return page_map
}

const create_page_entries = ({
	source_page_entries,
	source_parent_entry,
	page_entry_map = new Map(),
	page_map,
	page_type_field_map
}: {
	source_page_entries: ObjectOf<typeof PageEntries>[]
	source_parent_entry?: ObjectOf<typeof PageEntries>
	page_entry_map?: Map<string, ObjectOf<typeof PageEntries>>
	page_map: Map<string, ObjectOf<typeof Pages>>
	page_type_field_map: Map<string, ObjectOf<typeof PageTypeFields>>
}): Map<string, ObjectOf<typeof PageEntries>> => {
	for (const source_page_entry of source_page_entries) {
		if (source_parent_entry ? source_page_entry.parent !== source_parent_entry.id : source_page_entry.parent) {
			continue
		}

		const page = page_map.get(source_page_entry.page)
		if (!page) {
			throw new Error('No page for page entry')
		}

		const field = page_type_field_map.get(source_page_entry.field)
		if (!field) {
			throw new Error('No page type field for page entry')
		}

		const parent = source_page_entry.parent ? page_entry_map.get(source_page_entry.parent) : undefined
		if (source_page_entry.parent && !parent) {
			throw new Error('No parent page entry')
		}

		const entry = PageEntries.create({
			...source_page_entry.values(),
			id: undefined,
			page: page.id,
			field: field.id,
			parent: parent?.id,
			value: source_page_entry.value
		})
		page_entry_map.set(source_page_entry.id, entry)
		create_page_entries({
			source_page_entries,
			source_parent_entry: source_page_entry,
			page_entry_map,
			page_map,
			page_type_field_map
		})
	}
	return page_entry_map
}

const create_page_sections = ({
	source_page_sections,
	page_section_map = new Map(),
	page_map,
	site_symbol_map
}: {
	source_page_sections: ObjectOf<typeof PageSections>[]
	page_section_map?: Map<string, ObjectOf<typeof PageSections>>
	page_map: Map<string, ObjectOf<typeof Pages>>
	site_symbol_map: Map<string, ObjectOf<typeof SiteSymbols>>
}): Map<string, ObjectOf<typeof PageSections>> => {
	for (const source_page_section of source_page_sections) {
		const page = page_map.get(source_page_section.page)
		if (!page) {
			throw new Error('No page for page section')
		}

		const site_symbol = site_symbol_map.get(source_page_section.symbol)
		if (!site_symbol) {
			throw new Error('No site symbol for page section')
		}

		const section = PageSections.create({
			...source_page_section.values(),
			id: undefined,
			page: page.id,
			symbol: site_symbol.id
		})
		page_section_map.set(source_page_section.id, section)
	}
	return page_section_map
}

export const create_page_section_entries = ({
	source_page_section_entries,
	source_parent_entry,
	page_section_entry_map = new Map(),
	page_section_map,
	site_symbol_field_map
}: {
	source_page_section_entries: ObjectOf<typeof PageSectionEntries>[]
	source_parent_entry?: ObjectOf<typeof PageSectionEntries>
	page_section_entry_map?: Map<string, ObjectOf<typeof PageSectionEntries>>
	page_section_map: Map<string, ObjectOf<typeof PageSections>>
	site_symbol_field_map: Map<string, ObjectOf<typeof SiteSymbolFields>>
}): Map<string, ObjectOf<typeof PageSectionEntries>> => {
	for (const source_page_section_entry of source_page_section_entries) {
		if (source_parent_entry ? source_page_section_entry.parent !== source_parent_entry.id : source_page_section_entry.parent) {
			continue
		}

		const section = page_section_map.get(source_page_section_entry.section)
		if (!section) {
			throw new Error('No page section for page section entry')
		}

		const field = site_symbol_field_map.get(source_page_section_entry.field)
		if (!field) {
			throw new Error('No symbol field for page section entry')
		}

		const parent = source_page_section_entry.parent ? page_section_entry_map.get(source_page_section_entry.parent) : undefined
		if (source_page_section_entry.parent && !parent) {
			throw new Error('No parent page section entry')
		}

		const entry = PageSectionEntries.create({
			...source_page_section_entry.values(),
			id: undefined,
			section: section.id,
			field: field.id,
			parent: parent?.id,
			value: source_page_section_entry.value
		})
		page_section_entry_map.set(source_page_section_entry.id, entry)
		create_page_section_entries({
			source_page_section_entries,
			source_parent_entry: source_page_section_entry,
			page_section_entry_map,
			page_section_map,
			site_symbol_field_map
		})
	}
	return page_section_entry_map
}

const update_field_config_references = ({
	field_collection,
	field_map,
	page_type_map,
	page_type_field_map,
	site_field_map
}: {
	field_collection: CollectionMapping<any, any>
	field_map: Map<string, MappedObject<Field, any>>
	page_type_map: Map<string, ObjectOf<typeof PageTypes>>
	page_type_field_map: Map<string, ObjectOf<typeof PageTypeFields>>
	site_field_map: Map<string, ObjectOf<typeof SiteFields>>
}) => {
	for (const field of field_map.values()) {
		let { config } = field
		let do_update = true

		// Per field type
		if (field.type === 'page' && config?.page_type) {
			config = { ...config, page_type: page_type_map.get(config.page_type)?.id }
		} else if (field.type === 'page-field' && config?.field) {
			config = { ...config, field: page_type_field_map.get(config.field)?.id }
		} else if (field.type === 'page-list' && config?.page_type) {
			config = { ...config, page_type: page_type_map.get(config.page_type)?.id }
		} else if (field.type === 'site-field' && config?.field) {
			config = { ...config, field: site_field_map.get(config.field)?.id }
		} else {
			do_update = false
		}

		// All fields can have conditions
		if (config?.condition?.field) {
			config = {
				...config,
				condition: {
					...config.condition,
					field: field_map.get(config.condition.field)?.id
				}
			}
			do_update = true
		}

		if (do_update) {
			field_collection.update(field.id, { config })
		}
	}
}

const update_entry_value_references = ({
	entry_collection,
	entry_map,
	field_map,
	site_upload_map,
	page_map
}: {
	entry_collection: CollectionMapping<any, any>
	entry_map: Map<string, MappedObject<Entry, any>>
	field_map: Map<string, MappedObject<Field, any>>
	site_upload_map: Map<string, ObjectOf<typeof SiteUploads>>
	page_map: Map<string, ObjectOf<typeof Pages>>
}) => {
	for (const entry of entry_map.values()) {
		const field = field_map.values().find((field) => field.id === entry.field)
		if (!field) {
			throw new Error('No field for entry when updating entry value references')
		}

		let { value } = entry
		if (field.type === 'image' && value?.upload) {
			value = { ...value, upload: site_upload_map.get(value.upload)?.id }
		} else if (field.type === 'link' && value?.page) {
			value = { ...value, page: page_map.get(value.page)?.id }
		} else if (field.type === 'page' && value) {
			value = page_map.get(value)?.id
		} else {
			// Field type has no references to update
			continue
		}

		entry_collection.update(entry.id, { value })
	}
}
