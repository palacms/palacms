import { untrack } from 'svelte'
import type { Page } from './common/models/Page'
import type { PageEntry } from './common/models/PageEntry'
import type { PageSectionEntry } from './common/models/PageSectionEntry'
import type { PageType } from './common/models/PageType'
import type { PageTypeEntry } from './common/models/PageTypeEntry'
import type { PageTypeField } from './common/models/PageTypeField'
import type { PageTypeSectionEntry } from './common/models/PageTypeSectionEntry'
import type { SiteEntry } from './common/models/SiteEntry'
import type { SiteField } from './common/models/SiteField'
import type { SiteSymbol } from './common/models/SiteSymbol'
import type { SiteSymbolEntry } from './common/models/SiteSymbolEntry'
import type { SiteSymbolField } from './common/models/SiteSymbolField'
import { usePageData } from './PageData.svelte'
import {
	manager,
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
	SiteSymbols
} from './pocketbase/collections'

export const useCloneSite = ({ starter_site_id, site_name, site_host, site_group_id }: { starter_site_id?: string; site_name?: string; site_host?: string; site_group_id?: string }) => {
	let status = $state<'standby' | 'loading' | 'working'>('standby')
	let done = $state<(error?: unknown) => void>()

	const starter_site = $derived(starter_site_id ? Sites.one(starter_site_id) : undefined)
	const siteData = $derived(status === 'standby' ? { data: undefined } : usePageData(starter_site, starter_site?.pages()))

	$effect(() => {
		const { data } = siteData
		if (!data || !starter_site || !site_name || !site_host || !site_group_id) {
			return
		}

		if (status !== 'working') {
			status = 'working'
		} else {
			return
		}

		untrack(() => {
			const site = Sites.create({
				...starter_site.values(),
				id: undefined,
				name: site_name,
				description: '',
				host: site_host,
				group: site_group_id,
				index: 0
			})

			const site_field_map = new Map<string, SiteField>()
			const create_site_fields = (starter_parent_field?: SiteField) => {
				for (const starter_site_field of data.site_fields) {
					if (starter_parent_field ? starter_site_field.parent !== starter_parent_field.id : starter_site_field.parent) {
						continue
					}

					const parent = starter_site_field.parent ? site_field_map.get(starter_site_field.parent) : undefined
					if (starter_site_field.parent && !parent) {
						throw new Error('No parent site field')
					}

					const field = SiteFields.create({
						...starter_site_field.values(),
						id: undefined,
						site: site.id,
						parent: parent?.id
					})
					site_field_map.set(starter_site_field.id, field)
					create_site_fields(starter_site_field)
				}
			}
			create_site_fields()

			const site_entry_map = new Map<string, SiteEntry>()
			const create_site_entries = (starter_parent_entry?: SiteEntry) => {
				for (const starter_site_entry of data.site_entries) {
					if (starter_parent_entry ? starter_site_entry.parent !== starter_parent_entry.id : starter_site_entry.parent) {
						continue
					}

					const field = site_field_map.get(starter_site_entry.field)
					if (!field) {
						throw new Error('No site field for site entry')
					}

					const parent = starter_site_entry.parent ? site_entry_map.get(starter_site_entry.parent) : undefined
					if (starter_site_entry.parent && !parent) {
						throw new Error('No parent site entry')
					}

					const entry = SiteEntries.create({
						...starter_site_entry.values(),
						id: undefined,
						field: field.id,
						parent: parent?.id
					})
					site_entry_map.set(starter_site_entry.id, entry)
					create_site_entries(starter_site_entry)
				}
			}
			create_site_entries()

			const symbol_map = new Map<string, SiteSymbol>()
			const symbol_field_map = new Map<string, SiteSymbolField>()
			for (const starter_symbol of data.symbols) {
				const symbol = SiteSymbols.create({
					...starter_symbol.values(),
					id: undefined,
					site: site.id
				})
				symbol_map.set(starter_symbol.id, symbol)

				const create_symbol_fields = (starter_parent_field?: SiteSymbolField) => {
					for (const starter_symbol_field of data.symbol_fields) {
						if (starter_parent_field ? starter_symbol_field.parent !== starter_parent_field.id : starter_symbol_field.parent) {
							continue
						}

						if (starter_symbol_field.symbol !== starter_symbol.id) {
							continue
						}

						const parent = starter_symbol_field.parent ? symbol_field_map.get(starter_symbol_field.parent) : undefined
						if (starter_symbol_field.parent && !parent) {
							throw new Error('No parent symbol field')
						}

						const field = SiteSymbolFields.create({
							...starter_symbol_field.values(),
							id: undefined,
							symbol: symbol.id,
							parent: parent?.id
						})
						symbol_field_map.set(starter_symbol_field.id, field)
						create_symbol_fields(starter_symbol_field)
					}
				}
				create_symbol_fields()

				const symbol_entry_map = new Map<string, SiteSymbolEntry>()
				const create_symbol_entries = (starter_parent_entry?: SiteSymbolEntry) => {
					for (const starter_symbol_entry of data.symbol_entries) {
						if (starter_parent_entry ? starter_symbol_entry.parent !== starter_parent_entry.id : starter_symbol_entry.parent) {
							continue
						}

						const field = symbol_field_map.get(starter_symbol_entry.field)
						if (!field) {
							throw new Error('No symbol field for symbol entry')
						}

						const parent = starter_symbol_entry.parent ? symbol_entry_map.get(starter_symbol_entry.parent) : undefined
						if (starter_symbol_entry.parent && !parent) {
							throw new Error('No parent symbol entry')
						}

						const entry = SiteSymbolEntries.create({
							...starter_symbol_entry.values(),
							id: undefined,
							field: field.id,
							parent: parent?.id
						})
						symbol_entry_map.set(starter_symbol_entry.id, entry)
						create_symbol_entries(starter_symbol_entry)
					}
				}
				create_symbol_entries()
			}

			const page_type_map = new Map<string, PageType>()
			const page_type_field_map = new Map<string, PageTypeField>()
			for (const starter_page_type of data.page_types) {
				const page_type = PageTypes.create({
					...starter_page_type.values(),
					id: undefined,
					site: site.id
				})
				page_type_map.set(starter_page_type.id, page_type)

				const create_page_type_fields = (starter_parent_field?: PageTypeField) => {
					for (const starter_page_type_field of data.page_type_fields) {
						if (starter_parent_field ? starter_page_type_field.parent !== starter_parent_field.id : starter_page_type_field.parent) {
							continue
						}

						if (starter_page_type_field.page_type !== starter_page_type.id) {
							continue
						}

						const parent = starter_page_type_field.parent ? page_type_field_map.get(starter_page_type_field.parent) : undefined
						if (starter_page_type_field.parent && !parent) {
							throw new Error('No parent page type field')
						}

						const field = PageTypeFields.create({
							...starter_page_type_field.values(),
							id: undefined,
							page_type: page_type.id,
							parent: parent?.id
						})
						page_type_field_map.set(starter_page_type_field.id, field)
						create_page_type_fields(starter_page_type_field)
					}
				}
				create_page_type_fields()

				const page_type_entry_map = new Map<string, PageTypeEntry>()
				const create_page_type_entries = (starter_parent_entry?: PageTypeEntry) => {
					for (const starter_page_type_entry of data.page_type_entries) {
						if (starter_parent_entry ? starter_page_type_entry.parent !== starter_parent_entry.id : starter_page_type_entry.parent) {
							continue
						}

						const field = page_type_field_map.get(starter_page_type_entry.field)
						if (!field) {
							throw new Error('No page type field for page type entry')
						}

						const parent = starter_page_type_entry.parent ? page_type_entry_map.get(starter_page_type_entry.parent) : undefined
						if (starter_page_type_entry.parent && !parent) {
							throw new Error('No parent page type entry')
						}

						const entry = PageTypeEntries.create({
							...starter_page_type_entry.values(),
							id: undefined,
							field: field.id,
							parent: parent?.id
						})
						page_type_entry_map.set(starter_page_type_entry.id, entry)
						create_page_type_entries(starter_page_type_entry)
					}
				}
				create_page_type_entries()

				for (const starter_page_type_symbol of data.page_type_symbols) {
					if (starter_page_type_symbol.page_type !== starter_page_type.id) {
						continue
					}

					const symbol = symbol_map.get(starter_page_type_symbol.symbol)
					if (!symbol) {
						throw new Error('No symbol for page type symbol')
					}

					PageTypeSymbols.create({
						...starter_page_type_symbol.values(),
						id: undefined,
						page_type: page_type.id,
						symbol: symbol.id
					})
				}

				for (const starter_page_type_section of data.page_type_sections) {
					if (starter_page_type_section.page_type !== starter_page_type.id) {
						continue
					}

					const symbol = symbol_map.get(starter_page_type_section.symbol)
					if (!symbol) {
						throw new Error('No symbol for page type section')
					}

					const section = PageTypeSections.create({
						...starter_page_type_section.values(),
						id: undefined,
						page_type: page_type.id,
						symbol: symbol.id
					})

					const page_type_section_entry_map = new Map<string, PageTypeSectionEntry>()
					const create_page_type_section_entries = (starter_parent_entry?: PageTypeSectionEntry) => {
						for (const starter_page_type_section_entry of data.page_type_section_entries) {
							if (starter_parent_entry ? starter_page_type_section_entry.parent !== starter_parent_entry.id : starter_page_type_section_entry.parent) {
								continue
							}

							if (starter_page_type_section_entry.section !== starter_page_type_section.id) {
								continue
							}

							const field = symbol_field_map.get(starter_page_type_section_entry.field)
							if (!field) {
								throw new Error('No symbol field for page type section entry')
							}

							const parent = starter_page_type_section_entry.parent ? page_type_section_entry_map.get(starter_page_type_section_entry.parent) : undefined
							if (starter_page_type_section_entry.parent && !parent) {
								throw new Error('No parent page type section entry')
							}

							const entry = PageTypeSectionEntries.create({
								...starter_page_type_section_entry.values(),
								id: undefined,
								section: section.id,
								field: field.id,
								parent: parent?.id
							})
							page_type_section_entry_map.set(starter_page_type_section_entry.id, entry)
							create_page_type_section_entries(starter_page_type_section_entry)
						}
					}
					create_page_type_section_entries()
				}
			}

			const page_map = new Map<string, Page>()
			const create_pages = (starter_parent_page?: Page) => {
				for (const starter_page of data.pages) {
					if (starter_parent_page ? starter_page.parent !== starter_parent_page.id : starter_page.parent) {
						continue
					}

					const page_type = page_type_map.get(starter_page.page_type)
					if (!page_type) {
						throw new Error('No page type for page')
					}

					const parent = starter_page.parent ? page_map.get(starter_page.parent) : undefined
					if (starter_page.parent && !parent) {
						throw new Error('No parent page')
					}

					const page = Pages.create({
						...starter_page.values(),
						id: undefined,
						site: site.id,
						page_type: page_type.id,
						parent: parent?.id ?? '',
						compiled_html: undefined
					})
					page_map.set(starter_page.id, page)

					const page_entry_map = new Map<string, PageEntry>()
					const create_page_entries = (starter_parent_entry?: PageEntry) => {
						for (const starter_page_entry of data.page_entries) {
							if (starter_parent_entry ? starter_page_entry.parent !== starter_parent_entry.id : starter_page_entry.parent) {
								continue
							}

							if (starter_page_entry.page !== starter_page.id) {
								continue
							}

							const field = page_type_field_map.get(starter_page_entry.field)
							if (!field) {
								throw new Error('No page type field for page entry')
							}

							const parent = starter_page_entry.parent ? page_entry_map.get(starter_page_entry.parent) : undefined
							if (starter_page_entry.parent && !parent) {
								throw new Error('No parent page entry')
							}

							const entry = PageEntries.create({
								...starter_page_entry.values(),
								id: undefined,
								page: page.id,
								field: field.id
							})
							page_entry_map.set(starter_page_entry.id, entry)
							create_page_entries(starter_page_entry)
						}
					}
					create_page_entries()

					for (const starter_page_section of data.page_sections) {
						if (starter_page_section.page !== starter_page.id) {
							continue
						}

						const symbol = symbol_map.get(starter_page_section.symbol)
						if (!symbol) {
							throw new Error('No symbol for page section')
						}

						const section = PageSections.create({
							...starter_page_section.values(),
							id: undefined,
							page: page.id,
							symbol: symbol.id
						})

						const page_section_entry_map = new Map<string, PageSectionEntry>()
						const create_page_section_entries = (starter_parent_entry?: PageSectionEntry) => {
							for (const starter_page_section_entry of data.page_section_entries) {
								if (starter_parent_entry ? starter_page_section_entry.parent !== starter_parent_entry.id : starter_page_section_entry.parent) {
									continue
								}

								if (starter_page_section_entry.section !== starter_page_section.id) {
									continue
								}

								const field = symbol_field_map.get(starter_page_section_entry.field)
								if (!field) {
									throw new Error('No symbol field for page section entry')
								}

								const parent = starter_page_section_entry.parent ? page_section_entry_map.get(starter_page_section_entry.parent) : undefined
								if (starter_page_section_entry.parent && !parent) {
									throw new Error('No parent page section entry')
								}

								const entry = PageSectionEntries.create({
									...starter_page_section_entry.values(),
									id: undefined,
									section: section.id,
									field: field.id,
									parent: parent?.id
								})
								page_section_entry_map.set(starter_page_section_entry.id, entry)
								create_page_section_entries(starter_page_section_entry)
							}
						}
						create_page_section_entries()
					}

					create_pages(starter_page)
				}
			}
			create_pages()

			manager
				.commit()
				.then(() => {
					status = 'standby'
					done?.()
				})
				.catch((error) => {
					console.error('Clone failed:', error)
					status = 'standby'
					done?.(error) // Pass error to the done callback
				})
		})
	})

	return new (class {
		status = $derived(status)

		async cloneSite() {
			status = 'loading'
			return new Promise<void>((resolve, reject) => {
				done = (error) => {
					if (error) {
						reject(error)
					} else {
						resolve()
					}
				}
			})
		}
	})()
}
