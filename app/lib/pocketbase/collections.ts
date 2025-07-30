import { LibrarySymbol } from '$lib/common/models/LibrarySymbol'
import { LibrarySymbolEntry } from '$lib/common/models/LibrarySymbolEntry'
import { LibrarySymbolField } from '$lib/common/models/LibrarySymbolField'
import { LibrarySymbolGroup } from '$lib/common/models/LibrarySymbolGroup'
import { Page } from '$lib/common/models/Page'
import { PageEntry } from '$lib/common/models/PageEntry'
import { PageSection } from '$lib/common/models/PageSection'
import { PageSectionEntry } from '$lib/common/models/PageSectionEntry'
import { PageType } from '$lib/common/models/PageType'
import { PageTypeEntry } from '$lib/common/models/PageTypeEntry'
import { PageTypeField } from '$lib/common/models/PageTypeField'
import { PageTypeSection } from '$lib/common/models/PageTypeSection'
import { PageTypeSectionEntry } from '$lib/common/models/PageTypeSectionEntry'
import { PageTypeSymbol } from '$lib/common/models/PageTypeSymbol'
import { Site } from '$lib/common/models/Site'
import { SiteEntry } from '$lib/common/models/SiteEntry'
import { SiteField } from '$lib/common/models/SiteField'
import { SiteGroup } from '$lib/common/models/SiteGroup'
import { SiteSymbol } from '$lib/common/models/SiteSymbol'
import { SiteSymbolEntry } from '$lib/common/models/SiteSymbolEntry'
import { SiteSymbolField } from '$lib/common/models/SiteSymbolField'
import { User } from '$lib/common/models/User'
import { createCollectionManager } from './CollectionManager'
import { createCollectionMapping } from './CollectionMapping'

export const manager = createCollectionManager()

export const Users = createCollectionMapping('users', User, manager, {
	links: {
		site_groups() {
			return SiteGroups.list({ filter: `owner = "${this.id}"` })
		}
	}
})

export const LibrarySymbolGroups = createCollectionMapping('library_symbol_groups', LibrarySymbolGroup, manager, {
	links: {
		symbols() {
			return LibrarySymbols.from(this.collection.instance).list({ filter: `group = "${this.id}"` })
		}
	}
})

export const LibrarySymbols = createCollectionMapping('library_symbols', LibrarySymbol, manager, {
	links: {
		fields() {
			return LibrarySymbolFields.from(this.collection.instance).list({ filter: `symbol = "${this.id}"` })
		},
		entries() {
			const fields = LibrarySymbolFields.from(this.collection.instance).list({ filter: `symbol = "${this.id}"` })
			if (!fields) return undefined

			const entryLists = fields.map((field) => field.entries())
			if (entryLists.some((list) => list === undefined)) return undefined

			return entryLists.filter((list) => list !== undefined).flat()
		}
	}
})

export const LibrarySymbolFields = createCollectionMapping('library_symbol_fields', LibrarySymbolField, manager, {
	links: {
		entries() {
			return LibrarySymbolEntries.from(this.collection.instance).list({ filter: `field = "${this.id}"` })
		}
	}
})

export const LibrarySymbolEntries = createCollectionMapping('library_symbol_entries', LibrarySymbolEntry, manager, {
	links: {}
})

export const SiteGroups = createCollectionMapping('site_groups', SiteGroup, manager, {
	links: {
		sites() {
			return Sites.from(this.collection.instance).list({ filter: `group = "${this.id}"` })
		}
	}
})

export const Sites = createCollectionMapping('sites', Site, manager, {
	links: {
		symbols() {
			return SiteSymbols.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
		},
		fields() {
			return SiteFields.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
		},
		entries() {
			const fields = SiteFields.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
			if (!fields) return undefined

			const entryLists = fields.map((field) => field.entries())
			if (entryLists.some((list) => list === undefined)) return undefined

			return entryLists.filter((list) => list !== undefined).flat()
		},
		page_types() {
			return PageTypes.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
		},
		pages() {
			return Pages.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
		},
		homepage() {
			return Pages.from(this.collection.instance).list({ filter: `site = "${this.id}" && parent = ''` })?.[0]
		}
	}
})

export const SiteFields = createCollectionMapping('site_fields', SiteField, manager, {
	links: {
		entries() {
			return SiteEntries.from(this.collection.instance).list({ filter: `field = "${this.id}"` })
		}
	}
})

export const SiteEntries = createCollectionMapping('site_entries', SiteEntry, manager, {
	links: {}
})

export const SiteSymbols = createCollectionMapping('site_symbols', SiteSymbol, manager, {
	links: {
		fields() {
			return SiteSymbolFields.from(this.collection.instance).list({ filter: `symbol = "${this.id}"` })
		},
		entries() {
			const fields = SiteSymbolFields.from(this.collection.instance).list({ filter: `symbol = "${this.id}"` })
			if (!fields) return undefined

			const entryLists = fields.map((field) => field.entries())
			if (entryLists.some((list) => list === undefined)) return undefined

			return entryLists.filter((list) => list !== undefined).flat()
		}
	}
})

export const SiteSymbolFields = createCollectionMapping('site_symbol_fields', SiteSymbolField, manager, {
	links: {
		entries() {
			return SiteSymbolEntries.from(this.collection.instance).list({ filter: `field = "${this.id}"` })
		}
	}
})

export const SiteSymbolEntries = createCollectionMapping('site_symbol_entries', SiteSymbolEntry, manager, {
	links: {}
})

export const PageTypes = createCollectionMapping('page_types', PageType, manager, {
	links: {
		symbols() {
			return PageTypeSymbols.from(this.collection.instance).list({ filter: `page_type = "${this.id}"` })
		},
		sections() {
			return PageTypeSections.from(this.collection.instance).list({ filter: `page_type = "${this.id}"` })
		},
		fields() {
			return PageTypeFields.from(this.collection.instance).list({ filter: `page_type = "${this.id}"` })
		},
		entries() {
			const fields = PageTypeFields.from(this.collection.instance).list({ filter: `page_type = "${this.id}"` })
			if (!fields) return undefined

			const entryLists = fields.map((field) => field.entries())
			if (entryLists.some((list) => list === undefined)) return undefined

			return entryLists.filter((list) => list !== undefined).flat()
		}
	}
})

export const PageTypeFields = createCollectionMapping('page_type_fields', PageTypeField, manager, {
	links: {
		entries() {
			return PageTypeEntries.from(this.collection.instance).list({ filter: `field = "${this.id}"` })
		}
	}
})

export const PageTypeEntries = createCollectionMapping('page_type_entries', PageTypeEntry, manager, {
	links: {}
})

export const PageTypeSymbols = createCollectionMapping('page_type_symbols', PageTypeSymbol, manager, {
	links: {}
})

export const PageTypeSections = createCollectionMapping('page_type_sections', PageTypeSection, manager, {
	links: {
		entries() {
			return PageTypeSectionEntries.from(this.collection.instance).list({ filter: `section = "${this.id}"` })
		}
	}
})

export const PageTypeSectionEntries = createCollectionMapping('page_type_section_entries', PageTypeSectionEntry, manager, {
	links: {}
})

export const Pages = createCollectionMapping('pages', Page, manager, {
	links: {
		children() {
			return this.collection.list({ filter: `parent = "${this.id}"` })
		},
		sections() {
			return PageSections.from(this.collection.instance).list({ filter: `page = "${this.id}"` })
		},
		entries() {
			return PageEntries.from(this.collection.instance).list({ filter: `page = "${this.id}"` })
		}
	}
})

export const PageEntries = createCollectionMapping('page_entries', PageEntry, manager, {
	links: {}
})

export const PageSections = createCollectionMapping('page_sections', PageSection, manager, {
	links: {
		entries() {
			return PageSectionEntries.from(this.collection.instance).list({ filter: `section = "${this.id}"` })
		}
	}
})

export const PageSectionEntries = createCollectionMapping('page_section_entries', PageSectionEntry, manager, {
	links: {}
})
