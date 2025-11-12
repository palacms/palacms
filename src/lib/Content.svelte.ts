import type { Entry } from '$lib/common/models/Entry.js'
import type { locales } from './common'
import { SiteFields, Sites, Pages, PageTypeFields, PageTypes, SiteSymbols, LibrarySymbols, PageTypeSections, PageSections, LibraryUploads } from './pocketbase/collections'
import type { Field } from './common/models/Field'
import { get_empty_value, convert_markdown_to_html, convert_rich_text_to_html } from '$lib/builder/utils'
import { self } from './pocketbase/managers'
import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'
import { build_live_page_url } from './pages'
import { page_context, page_type_context, site_context } from './builder/stores/context'

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

export type UseContentOptions = {
	/**
	 * Whether the content should be tailored for a published site or editing.
	 * This can effect how links are generated.
	 */
	target: 'cms' | 'live'

	/**
	 * Page that will be used when referencing current page. This will be used
	 * when resolving page fields for example.
	 */
	page?: ObjectOf<typeof Pages>
}

export const useContent = <Collection extends keyof typeof ENTITY_COLLECTIONS>(entity: EntityOf<Collection>, options: UseContentOptions) => {
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

	const getContent = ({
		entity,
		fields,
		entries,
		parentField,
		parentEntry
	}: {
		entity?: Entity | null
		fields?: Field[] | null
		entries?: Entry[] | null
		parentField?: Field | null
		parentEntry?: Entry | null
	}) => {
		if (!entity || !fields || !entries || !uploads) {
			return
		}

		const content: { [K in (typeof locales)[number]]?: Record<string, unknown> } = {}
		const filteredFields = fields
			.filter((field) => {
				if ('symbol' in entity) {
					// section
					return 'symbol' in field && field.symbol === entity.symbol
				} else if ('slug' in entity) {
					// page
					return 'page_type' in field && field.page_type === entity.page_type
				} else if ('symbol' in field) {
					// symbol
					return field.symbol === entity.id
				} else if ('site' in field) {
					// site
					return field.site === entity.id
				} else if ('page_type' in field) {
					// page_type
					return field.page_type === entity.id
				} else {
					return false
				}
			})
			.filter((field) => (parentField ? field.parent === parentField.id : !field.parent))
			// Deduplicate
			.filter((field1, index, array) => array.findIndex((field2) => field2.id === field1.id) === index)
			// Remove fields without a key
			.filter((field) => !!field.key)

		for (const field of filteredFields) {
			const fieldEntries = resolveEntries({ entity, field, entries, parentEntry })
			if (!field.key) continue
			if (!fieldEntries) continue

			// If field has a key but no entries, fill with empty value
			// Skip repeaters and groups since they handle empty state themselves
			if (field.key && fieldEntries.length === 0 && field.type !== 'repeater' && field.type !== 'group') {
				if (!content.en) content.en = {}
				content.en![field.key] = get_empty_value(field)
				continue
			}

			// Handle page-field fields specially - get content from the page entity
			// Fallback behavior: If the referenced page field doesn't exist on the
			// current page type (or the value hasn't loaded yet), we degrade
			// gracefully by assigning a type-appropriate empty value via
			// get_empty_value(pageField). This prevents render errors and matches
			// the editor behavior where irrelevant Page Fields are hidden from
			// content editors. The fallback is applied consistently in all
			// assignment branches below using `?? get_empty_value(pageField)`.
			if (field.type === 'page-field') {
				const locale = 'en'
				if (!content[locale]) content[locale] = {}

				if (!field.config?.field) continue
				const pageField = PageTypeFields.one(field.config.field)
				if (pageField === null) continue
				if (!pageField) continue
				if (!pageField.key) continue

				let data: ReturnType<typeof getContent> | null = null

				// Prevent self-reference for pages and page_types
				if ('slug' in entity) {
					// This a page, cannot self-reference
					continue
				} else if ('site' in entity && 'head' in entity) {
					// This is page type, cannot self-reference
					continue
				}

				const { value: page } = page_context.getOr({ value: null })
				const { value: pageType } = page_type_context.getOr({ value: null })
				const { value: site } = site_context.getOr({ value: null })

				if (options.page) {
					// Override current page from options
					const page = options.page

					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) continue
					if (!pageType) continue

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) continue

					const pageEntries = page?.entries()
					if (pageEntries === null) continue
					if (!pageEntries) continue

					data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) continue

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				}
				// No override, use the page or page_type context if available
				else if (page) {
					// Use the current page
					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) continue
					if (!pageType) continue

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) continue

					const pageEntries = page?.entries()
					if (pageEntries === null) continue
					if (!pageEntries) continue

					data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) continue

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				} else if (pageType) {
					// Use the current page type
					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) continue

					const pageTypeEntries = pageType?.entries()
					if (pageTypeEntries === null) continue
					if (!pageTypeEntries) continue

					data = getContent({ entity: pageType, fields: pageTypeFields, entries: pageTypeEntries })
					if (!data) continue

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				} else if (site) {
					// Use the home page
					const page = site.homepage()
					if (page === null) continue
					if (!page) continue

					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) continue
					if (!pageType) continue

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) continue

					const pageEntries = page?.entries()
					if (pageEntries === null) continue
					if (!pageEntries) continue

					data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) continue

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				}
				// No page, page_type, or site contexts, use parent entity
				else if ('page' in entity) {
					// This is a page section, use the parent page
					const page = Pages.one(entity.page)
					if (page === null) continue
					if (!page) continue

					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) continue
					if (!pageType) continue

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) continue

					const pageEntries = page?.entries()
					if (pageEntries === null) continue
					if (!pageEntries) continue

					data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) continue

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				} else if ('page_type' in entity) {
					// This is page type section, use the parent page type
					const pageType = PageTypes.one(entity.page_type)
					if (pageType === null) continue
					if (!pageType) continue

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) continue
					if (!pageTypeFields) continue

					const pageTypeEntries = pageType?.entries()
					if (pageTypeEntries === null) continue
					if (!pageTypeEntries) continue

					data = getContent({ entity: pageType, fields: pageTypeFields, entries: pageTypeEntries })
					if (!data) continue

					content[locale]![field.key] = data[locale]?.[pageField.key] ?? get_empty_value(pageField)
				}
			}

			// Handle site fields specially - get content from the site entity
			else if (field.type === 'site-field') {
				const locale = 'en'
				if (!content[locale]) content[locale] = {}

				if (!field.config?.field) continue
				const siteField = SiteFields.one(field.config.field)
				if (siteField === null) continue
				if (!siteField) continue
				if (!siteField.key) continue

				const site = Sites.one(siteField.site)
				if (site === null) continue
				if (!site) continue

				const siteFields = site.fields()
				if (siteFields === null) continue
				if (!siteFields) continue

				const siteEntries = site.entries()
				if (siteEntries === null) continue
				if (!siteEntries) continue

				const data = getContent({ entity: site, fields: siteFields, entries: siteEntries })
				if (!data) continue

				content[locale]![field.key] = data[locale]?.[siteField.key]
			}

			// Handle group fields specially - collect subfield entries into an object
			else if (field.type === 'group') {
				const locale = 'en'
				if (!content[locale]) content[locale] = {}
				content[locale]![field.key] = {}

				const [entry] = fieldEntries
				const data = getContent({ entity, fields, entries, parentField: field, parentEntry: entry })
				if (!data) {
					content[entry.locale]![field.key] = {}
					continue
				}

				content[locale]![field.key] = data[locale]
			}

			// Handle repeater fields specially - collect array of subfield entries into an object
			else if (field.type === 'repeater') {
				// Ensure we always provide an array, even if there are no entries
				if (fieldEntries.length === 0) {
					if (!content.en) content.en = {}
					content.en![field.key] = []
				}
				for (const entry of fieldEntries) {
					if (!content[entry.locale]) content[entry.locale] = {}
					if (!content[entry.locale]![field.key]) content[entry.locale]![field.key] = []

					const data = getContent({ entity, fields, entries, parentField: field, parentEntry: entry })
					if (!data) continue
						; (content[entry.locale]![field.key] as unknown[]).push(data[entry.locale])
				}
			}

			// Handle markdown fields: markdown -> HTML
			else if (field.type === 'markdown') {
				const [entry] = fieldEntries
				if (!entry) continue
				if (typeof entry.value !== 'string') continue
				if (!content[entry.locale]) content[entry.locale] = {}

				content[entry.locale]![field.key] = convert_markdown_to_html(entry.value)
			}

			// Handle rich-text fields: JSON -> HTML
			else if (field.type === 'rich-text') {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}
				const html = convert_rich_text_to_html(entry.value)
				content[entry.locale]![field.key] = html
			}

			// Handle image fields specially - get url
			else if (field.type === 'image') {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}

				const upload_id: string | null | undefined = entry.value.upload
				const upload = upload_id ? uploads.find((upload) => upload.id === upload_id) : null

				const upload_url =
					upload &&
					(options.target === 'live'
						? `/_uploads/${upload.file}`
						: typeof upload.file === 'string'
							? `${self.instance.baseURL}/api/files/${'group' in entity ? 'library_uploads' : 'site_uploads'}/${upload.id}/${upload.file}`
							: URL.createObjectURL(upload.file))
				const input_url: string | undefined = entry.value.url
				const url = input_url || upload_url
				const alt: string = entry.value.alt
				const width: number | null | undefined = entry.value.width
				const height: number | null | undefined = entry.value.height
				content[entry.locale]![field.key] = { alt, url, width, height }
			}

			// Handle page fields specially - get content from the page entity
			else if (field.type === 'page') {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}

				const page = Pages.one(entry.value)
				if (page === null) continue
				if (!page) continue

				const pageType = PageTypes.one(page.page_type)
				if (pageType === null) continue
				if (!pageType) continue

				const pageTypeFields = pageType.fields()
				if (pageTypeFields === null) continue
				if (!pageTypeFields) continue

				const pageEntries = page.entries()
				if (pageEntries === null) continue
				if (!pageEntries) continue

				const data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
				if (!data) continue

				const url = build_live_page_url(page)?.pathname
				if (url === undefined) continue

				content[entry.locale]![field.key] = {
					...data[entry.locale],
					_meta: {
						created_at: page.created, // TODO: Fix typing
						name: page.name,
						slug: page.slug,
						url
					}
				}
			}

			// Handle page-list fields specially
			else if (field.type === 'page-list') {
				if (!field.config?.page_type) continue
				const pages = Pages.list({ filter: { page_type: field.config.page_type } })?.sort((a, b) => a.index - b.index)
				if (pages === null) continue
				if (!pages) continue

				const data = pages.map((page) => {
					const pageType = PageTypes.one(page.page_type)
					if (pageType === null) return null
					if (!pageType) return

					const pageTypeFields = pageType.fields()
					if (pageTypeFields === null) return null
					if (!pageTypeFields) return

					const pageEntries = page.entries()
					if (pageEntries === null) return null
					if (!pageEntries) return

					const data = getContent({ entity: page, fields: pageTypeFields, entries: pageEntries })
					if (!data) return

					return data
				})
				if (data.some((content) => content === null)) continue
				if (data.some((content) => !content)) continue

				for (let index = 0; index < pages.length; index++) {
					for (const locale in { en: {}, ...data[index] }) {
						if (!content[locale]) content[locale] = {}
						if (!content[locale][field.key]) content[locale][field.key] = []

						const url = build_live_page_url(pages[index])?.pathname
						if (url === undefined) continue

						content[locale][field.key].push({
							...data[index]?.[locale],
							_meta: {
								created_at: pages[index].created, // TODO: Fix typing
								name: pages[index].name,
								slug: pages[index].slug,
								url
							}
						})
					}
				}
			}

			// Handle link fields specifially - translate page ID into URL
			else if (field.type === 'link') {
				const [entry] = fieldEntries
				if (!entry) continue
				if (!content[entry.locale]) content[entry.locale] = {}

				// If a page is referenced, try to resolve it; otherwise fall back to the raw URL
				const page = entry.value.page ? Pages.one(entry.value.page) : null
				// If the referenced page hasn't loaded yet, skip this field for now instead of aborting
				if (page === undefined) continue

				const url = page ? build_live_page_url(page)?.pathname : entry.value.url
				// If we still don't have a URL (e.g. unresolved page and no URL), set empty string rather than aborting
				const safe_url = url ?? ''

				const label = entry.value.label ?? ''
				content[entry.locale]![field.key] = { url: safe_url, label, text: label }
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

	return getContent({ entity, fields, entries })
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

	return entries && resolveEntries({ entity, field, entries, parentEntry })
}

const resolveEntries = ({ entity, field, entries, parentEntry }: { entity: Entity; field: Field; entries: Entry[]; parentEntry?: Entry | null }): Entry[] | undefined => {
	const fieldEntries = entries
		.filter((entry) => entry.field === field.id && (!('section' in entry) || entry.section === entity.id))
		.filter((entry) => (parentEntry ? entry.parent === parentEntry.id : !entry.parent))
		.sort((a, b) => a.index - b.index)

	// Handle page-field fields specially - get entries from the page entity
	if (field.type === 'page-field' && field.key) {
		if (!field.config?.field) return []
		const sourceField = PageTypeFields.one(field.config.field)
		if (sourceField === null) return []
		if (!sourceField) return

		let sourceEntity: ObjectOf<typeof Pages> | ObjectOf<typeof PageTypes> | undefined | null = null

		// Try to use the page or page_type context first
		const { value: page } = page_context.getOr({ value: null })
		const { value: pageType } = page_type_context.getOr({ value: null })
		if (page) {
			// Page context found
			sourceEntity = page
		} else if (pageType) {
			// Page type context found
			sourceEntity = pageType
		}
		// No page or page_type contexts, use parent entity
		else if ('page' in entity) {
			// This is a page section, use the parent page
			sourceEntity = Pages.one(entity.page)
		} else if ('page_type' in entity) {
			// This is page type section, use the parent page type
			sourceEntity = PageTypes.one(entity.page_type)
		}

		if (sourceEntity === null) return []
		if (!sourceEntity) return

		const sourceEntries = 'page_type' in sourceEntity ? sourceEntity.entries() : sourceEntity.entries()
		if (sourceEntries === null) return []
		if (!sourceEntries) return

		return resolveEntries({ entity: sourceEntity, field: sourceField, entries: sourceEntries })
	}

	// Handle site fields specially - get entries from the site entity
	else if (field.type === 'site-field' && field.key) {
		if (!field.config?.field) return []
		const siteField = SiteFields.one(field.config.field)
		if (siteField === null) return []
		if (!siteField) return

		const site = Sites.one(siteField.site)
		if (site === null) return []
		if (!site) return

		const siteEntries = site.entries()
		if (siteEntries === null) return []
		if (!siteEntries) return

		return resolveEntries({ entity: site, field: siteField, entries: siteEntries })
	}

	// Otherwise, return direct entries
	else {
		return fieldEntries
	}
}
