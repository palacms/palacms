import type { Entry } from '$lib/common/models/Entry.js'
import type { locales } from './common'
import { SiteFields, Sites, Pages, PageTypeFields, PageTypes, SiteSymbols, LibrarySymbols, PageTypeSections, PageSections, LibraryUploads } from './pocketbase/collections'
import type { Field } from './common/models/Field'
import { get_empty_value } from '$lib/builder/utils'
import { self } from './pocketbase/PocketBase'
import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'

/**
 * Entry models by name of the owning collection.
 */
export const ENTITY_COLLECTIONS = {
	library_symbols: LibrarySymbols,
	sites: Sites,
	site_symbols: SiteSymbols,
	page_types: PageTypes,
	pages: Pages,
	page_type_sections: PageTypeSections,
	page_sections: PageSections
} as const

export type EntityOf<Collection extends keyof typeof ENTITY_COLLECTIONS> = ObjectOf<(typeof ENTITY_COLLECTIONS)[Collection]>
export type Entity = EntityOf<keyof typeof ENTITY_COLLECTIONS>

export const useContent = <Collection extends keyof typeof ENTITY_COLLECTIONS>(entity: EntityOf<Collection>) => {
	const [fields, entries, uploads] = (() => {
		switch (true) {
			// library_symbols
			case 'group' in entity && 'html' in entity: {
				return [entity.fields(), entity.entries(), LibraryUploads.list()] as const
			}

			// sites
			case 'host' in entity: {
				return [entity.fields(), entity.entries(), entity.uploads()] as const
			}

			// site_symbols
			case 'html' in entity: {
				const site = Sites.one(entity.site)
				return [entity.fields(), entity.entries(), site?.uploads()] as const
			}

			// page_types
			case 'head' in entity: {
				const site = Sites.one(entity.site)
				return [entity.fields(), entity.entries(), site?.uploads()] as const
			}

			// pages
			case 'slug' in entity: {
				const page_type = PageTypes.one(entity.page_type)
				const site = Sites.one(entity.site)
				return [page_type?.fields(), entity.entries(), site?.uploads()] as const
			}

			// page_type_sections
			case 'page_type' in entity && 'symbol' in entity: {
				const symbol = SiteSymbols.one(entity.symbol)
				const site = symbol && Sites.one(symbol.site)
				return [symbol?.fields(), entity.entries(), site?.uploads()] as const
			}

			// page_sections
			case 'page' in entity && 'symbol' in entity: {
				const symbol = SiteSymbols.one(entity.symbol)
				const site = symbol && Sites.one(symbol.site)
				return [symbol?.fields(), entity.entries(), site?.uploads()] as const
			}

			default: {
				throw new Error('Unknown entity')
			}
		}
	})()

	const getContent = (parentField?: Field, parentEntry?: Entry) => {
		if (!fields || !entries || !uploads) {
			return
		}

		const content: { [K in (typeof locales)[number]]?: Record<string, unknown> } = {}
		const filteredFields = fields
			.filter((field) =>
				'symbol' in entity
					? 'symbol' in field && field.symbol === entity.symbol
					: (!('symbol' in field) || field.symbol === entity.id) && (!('site' in field) || field.site === entity.id) && (!('page_type' in field) || field.page_type === entity.id)
			)
			.filter((field) => (parentField ? field.parent === parentField.id : !field.parent))
			// Deduplicate
			.filter((field1, index, array) => array.findIndex((field2) => field2.id === field1.id) === index)

		for (const field of filteredFields) {
			const fieldEntries = resolveEntries(entity, field, entries, parentEntry)
			if (!fieldEntries) return

			// Handle group fields specially - collect subfield entries into an object
			if (field.type === 'group' && field.key) {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}

				const data = getContent(field, entry)
				if (!data) return

				content[entry.locale]![field.key] = data[entry.locale]
			}

			// Handle repeater fields specially - collect array of subfield entries into an object
			else if (field.type === 'repeater' && field.key) {
				for (const entry of fieldEntries) {
					if (!content[entry.locale]) content[entry.locale] = {}
					if (!content[entry.locale]![field.key]) content[entry.locale]![field.key] = []

					const data = getContent(field, entry)
					if (!data) return
					;(content[entry.locale]![field.key] as unknown[]).push(data[entry.locale])
				}
			}

			// Handle image fields specially - get url
			else if (field.type === 'image' && field.key) {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}

				const upload_id: string | null | undefined = entry.value.upload
				const upload = upload_id ? uploads.find((upload) => upload.id === upload_id) : null
				const upload_url =
					upload &&
					(typeof upload.file === 'string' ? `${self.baseURL}/api/files/${'group' in entity ? 'library_uploads' : 'site_uploads'}/${upload.id}/${upload.file}` : URL.createObjectURL(upload.file))
				const input_url: string | undefined = entry.value.url
				const url = input_url || upload_url
				const alt: string = entry.value.alt
				content[entry.locale]![field.key] = { alt, url }
			}

			// Handle page fields specially - get content from the page entity
			else if (field.type === 'page' && field.key) {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}

				const page = Pages.one(entry.value)
				if (!page) return

				const data = useContent(page)
				if (!data) return

				content[entry.locale]![field.key] = {
					...data[entry.locale],
					_meta: {
						created_at: page.created, // TODO: Fix typing
						name: page.name,
						slug: page.slug,
						url: `/${page.slug}` // TODO: Fix URL (hierarchy)
					}
				}
			}

			// Handle page-list fields specially
			else if (field.type === 'page-list' && field.key) {
				const pages = Pages.list({ filter: { page_type: field.config.page_type } })?.sort((a, b) => a.index - b.index)
				if (!pages) return

				const data = pages.map((page) => useContent(page))
				if (data.some((content) => !content)) return

				for (let index = 0; index < pages.length; index++) {
					for (const locale in { en: {}, ...data[index] }) {
						if (!content[locale]) content[locale] = {}
						if (!content[locale][field.key]) content[locale][field.key] = []
						content[locale][field.key].push({
							...data[index]?.[locale],
							_meta: {
								created_at: pages[index].created, // TODO: Fix typing
								name: pages[index].name,
								slug: pages[index].slug,
								url: `/${pages[index].slug}` // TODO: Fix URL (hierarchy)
							}
						})
					}
				}
			}

			// If field has a key but no entries, fill with empty value
			else if (field.key && fieldEntries.length === 0) {
				if (!content.en) content.en = {}
				content.en![field.key] = get_empty_value(field)
			}

			// For single-value fields, collect just get the first value
			else if (field.key) {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}
				content[entry.locale]![field.key] = entry.value
			}
		}

		return content
	}

	return getContent()
}

export const useEntries = (entity: Entity, field: Field, parentEntry?: Entry) => {
	const entries = (() => {
		switch (true) {
			// library_symbols
			case 'group' in entity && 'html' in entity:
				return entity.entries()

			// sites
			case 'host' in entity:
				return entity.entries()

			// site_symbols
			case 'html' in entity:
				return entity.entries()

			// page_types
			case 'head' in entity:
				return entity.entries()

			// pages
			case 'slug' in entity:
				return entity.entries()

			// page_type_sections
			case 'page_type' in entity && 'symbol' in entity:
				return entity.entries()

			// page_sections
			case 'page' in entity && 'symbol' in entity:
				return entity.entries()

			default:
				throw new Error('Unknown entity')
		}
	})()

	return entries && resolveEntries(entity, field, entries, parentEntry)
}

const resolveEntries = (entity: Entity, field: Field, entries: Entry[], parentEntry?: Entry): Entry[] | undefined => {
	const fieldEntries = entries
		.filter((entry) => entry.field === field.id && (!('section' in entry) || entry.section === entity.id))
		.filter((entry) => (parentEntry ? entry.parent === parentEntry.id : !entry.parent))
		.sort((a, b) => a.index - b.index)

	// Handle page-field fields specially - get entries from the page entity
	if (field.type === 'page-field' && field.key) {
		if (!field.config?.field) return []
		const sourceField = PageTypeFields.one(field.config.field)
		if (!sourceField) return

		let sourceEntity: ObjectOf<typeof Pages> | ObjectOf<typeof PageTypes> | undefined | null
		if ('page' in entity && 'symbol' in entity) {
			// This is a page section, get the page
			sourceEntity = Pages.one(entity.page)
		} else if ('page_type' in entity && 'symbol' in entity) {
			// This is page type section, get the page type
			sourceEntity = PageTypes.one(entity.page_type)
		} else if ('slug' in entity) {
			// This a page
			sourceEntity = entity
		} else if ('site' in entity && 'head' in entity) {
			// This is page type
			sourceEntity = entity
		} else {
			// Entity is not related to any page or page type
			return []
		}
		if (!sourceEntity) return

		const sourceEntries = 'page_type' in sourceEntity ? sourceEntity.entries() : sourceEntity.entries()
		if (!sourceEntries) return

		return resolveEntries(sourceEntity, sourceField, sourceEntries)
	}

	// Handle site fields specially - get entries from the site entity
	else if (field.type === 'site-field' && field.key) {
		if (!field.config?.field) return []
		const siteField = SiteFields.one(field.config.field)
		if (!siteField) return

		const site = Sites.one(siteField.site)
		if (!site) return

		const siteEntries = site.entries()
		if (!siteEntries) return

		return resolveEntries(site, siteField, siteEntries)
	}

	// Otherwise, return direct entries
	else {
		return fieldEntries
	}
}
