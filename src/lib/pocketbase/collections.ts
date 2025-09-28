import { LibrarySymbol } from '$lib/common/models/LibrarySymbol'
import { LibrarySymbolEntry } from '$lib/common/models/LibrarySymbolEntry'
import { LibrarySymbolField } from '$lib/common/models/LibrarySymbolField'
import { LibrarySymbolGroup } from '$lib/common/models/LibrarySymbolGroup'
import { LibraryUpload } from '$lib/common/models/LibraryUpload'
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
import { SiteRoleAssignment } from '$lib/common/models/SiteRoleAssignment'
import { SiteSymbol } from '$lib/common/models/SiteSymbol'
import { SiteSymbolEntry } from '$lib/common/models/SiteSymbolEntry'
import { SiteSymbolField } from '$lib/common/models/SiteSymbolField'
import { SiteUpload } from '$lib/common/models/SiteUpload'
import { User } from '$lib/common/models/User'
import { createCollectionManager } from './CollectionManager'
import { createCollectionMapping } from './CollectionMapping.svelte'
import { marketplace } from './PocketBase'

export const manager = createCollectionManager()
export const marketplace_manager = createCollectionManager()

export const Users = createCollectionMapping('users', User, manager, {
	subscribe: true,
	links: {
		site_groups() {
			return SiteGroups.list()
		},
		site_role_assignments() {
			return SiteRoleAssignments.list({ filter: { user: this.id } })
		}
	}
})

export const LibrarySymbolGroups = createCollectionMapping('library_symbol_groups', LibrarySymbolGroup, manager, {
	subscribe: true,
	links: {
		symbols() {
			return LibrarySymbols.from(this.collection.instance).list({ filter: { group: this.id } })
		}
	}
})

export const MarketplaceSymbolGroups = createCollectionMapping('library_symbol_groups', LibrarySymbolGroup, marketplace_manager, {
	instance: marketplace,
	subscribe: false,
	links: {
		symbols() {
			return MarketplaceSymbols.list({ filter: { group: this.id } })
		}
	}
})

export const MarketplaceSymbols = createCollectionMapping('library_symbols', LibrarySymbol, marketplace_manager, {
	instance: marketplace,
	subscribe: false,
	links: {
		fields() {
			return LibrarySymbolFields.from(this.collection.instance).list({ filter: { symbol: this.id } })
		},
		entries() {
			const fields = LibrarySymbolFields.from(this.collection.instance).list({ filter: { symbol: this.id } })
			if (!fields) {
				return fields
			}

			const entries = fields.map((field) => LibrarySymbolEntries.from(this.collection.instance).list({ filter: { field: field.id } }))
			if (entries.some((entry) => entry === null)) {
				return null
			}
			if (entries.some((entry) => !entry)) {
				return undefined
			}

			return entries.filter((entry) => !!entry).flat()
		}
	}
})

// Marketplace Sites and Groups (for Starter selection UI)
export const MarketplaceSiteGroups = createCollectionMapping('site_groups', SiteGroup, marketplace_manager, {
	instance: marketplace,
	subscribe: false,
	links: {
		sites() {
			return MarketplaceSites.from(this.collection.instance).list({ filter: { group: this.id } })
		}
	}
})

export const MarketplaceSites = createCollectionMapping('sites', Site, marketplace_manager, {
	instance: marketplace,
	subscribe: false,
	links: {
		pages() {
			return Pages.from(this.collection.instance).list({ filter: { site: this.id } })
		},
		page_types() {
			return PageTypes.from(this.collection.instance).list({ filter: { site: this.id } })
		},
		symbols() {
			return SiteSymbols.from(this.collection.instance).list({ filter: { site: this.id } })
		},
		uploads() {
			return SiteUploads.from(this.collection.instance).list({ filter: { site: this.id } })
		}
	}
})

export const LibrarySymbols = createCollectionMapping('library_symbols', LibrarySymbol, manager, {
	subscribe: true,
	links: {
		fields() {
			return LibrarySymbolFields.from(this.collection.instance).list({ filter: { symbol: this.id } })
		},
		entries() {
			const fields = LibrarySymbolFields.from(this.collection.instance).list({ filter: { symbol: this.id } })
			if (!fields) {
				return fields
			}

			const entries = fields.map((field) => LibrarySymbolEntries.from(this.collection.instance).list({ filter: { field: field.id } }))
			if (entries.some((entry) => entry === null)) {
				return null
			}
			if (entries.some((entry) => !entry)) {
				return undefined
			}

			return entries.filter((entry) => !!entry).flat()
		}
	}
})

export const LibrarySymbolFields = createCollectionMapping('library_symbol_fields', LibrarySymbolField, manager, {
	subscribe: true,
	links: {
		entries() {
			return LibrarySymbolEntries.from(this.collection.instance).list({ filter: { field: this.id } })
		}
	}
})

export const LibrarySymbolEntries = createCollectionMapping('library_symbol_entries', LibrarySymbolEntry, manager, {
	subscribe: true,
	links: {}
})

export const LibraryUploads = createCollectionMapping('library_uploads', LibraryUpload, manager, {
	subscribe: true,
	links: {}
})

export const SiteGroups = createCollectionMapping('site_groups', SiteGroup, manager, {
	subscribe: true,
	links: {
		sites() {
			return Sites.from(this.collection.instance).list({ filter: { group: this.id } })
		}
	}
})

export const Sites = createCollectionMapping('sites', Site, manager, {
	subscribe: true,
	links: {
		role_assignments() {
			return SiteRoleAssignments.from(this.collection.instance).list({ filter: { site: this.id } })
		},
		symbols() {
			return SiteSymbols.from(this.collection.instance).list({ filter: { site: this.id }, sort: '-created' })
		},
		fields() {
			return SiteFields.from(this.collection.instance).list({ filter: { site: this.id } })
		},
		entries() {
			return SiteEntries.from(this.collection.instance).list({ filter: { 'field.site': this.id } })
		},
		uploads() {
			return SiteUploads.from(this.collection.instance).list({ filter: { site: this.id } })
		},
		page_types() {
			// Sort by creation time ascending so newly created types appear at the bottom
			return PageTypes.from(this.collection.instance).list({ filter: { site: this.id }, sort: 'created' })
		},
		pages() {
			return Pages.from(this.collection.instance).list({ filter: { site: this.id } })
		},
		homepage() {
			return Pages.from(this.collection.instance).list({ filter: { site: this.id, parent: '' } })?.[0]
		}
	}
})

export const SiteRoleAssignments = createCollectionMapping('site_role_assignments', SiteRoleAssignment, manager, {
	subscribe: true,
	links: {}
})

export const SiteFields = createCollectionMapping('site_fields', SiteField, manager, {
	subscribe: true,
	links: {
		entries() {
			return SiteEntries.from(this.collection.instance).list({ filter: { field: this.id } })
		}
	}
})

export const SiteEntries = createCollectionMapping('site_entries', SiteEntry, manager, {
	subscribe: true,
	links: {}
})

export const SiteSymbols = createCollectionMapping('site_symbols', SiteSymbol, manager, {
	subscribe: true,
	links: {
		fields() {
			return SiteSymbolFields.from(this.collection.instance).list({ filter: { symbol: this.id } })
		},
		entries() {
			const fields = SiteSymbolFields.from(this.collection.instance).list({ filter: { symbol: this.id } })
			if (!fields) {
				return fields
			}

			const entries = fields.map((field) => SiteSymbolEntries.from(this.collection.instance).list({ filter: { field: field.id } }))
			if (entries.some((entry) => entry === null)) {
				return null
			}
			if (entries.some((entry) => !entry)) {
				return undefined
			}

			return entries.filter((entry) => !!entry).flat()
		}
	}
})

export const SiteSymbolFields = createCollectionMapping('site_symbol_fields', SiteSymbolField, manager, {
	subscribe: true,
	links: {
		entries() {
			return SiteSymbolEntries.from(this.collection.instance).list({ filter: { field: this.id } })
		}
	}
})

export const SiteSymbolEntries = createCollectionMapping('site_symbol_entries', SiteSymbolEntry, manager, {
	subscribe: true,
	links: {}
})

export const PageTypes = createCollectionMapping('page_types', PageType, manager, {
	subscribe: true,
	links: {
		symbols() {
			return PageTypeSymbols.from(this.collection.instance).list({ filter: { page_type: this.id } })
		},
		sections() {
			return PageTypeSections.from(this.collection.instance).list({ filter: { page_type: this.id } })
		},
		fields() {
			return PageTypeFields.from(this.collection.instance).list({ filter: { page_type: this.id } })
		},
		entries() {
			const fields = PageTypeFields.from(this.collection.instance).list({ filter: { page_type: this.id } })
			if (!fields) {
				return fields
			}

			const entries = fields.map((field) => PageTypeEntries.from(this.collection.instance).list({ filter: { field: field.id } }))
			if (entries.some((entry) => entry === null)) {
				return null
			}
			if (entries.some((entry) => !entry)) {
				return undefined
			}

			return entries.filter((entry) => !!entry).flat()
		}
	}
})

export const PageTypeFields = createCollectionMapping('page_type_fields', PageTypeField, manager, {
	subscribe: true,
	links: {
		entries() {
			return PageTypeEntries.from(this.collection.instance).list({ filter: { field: this.id } })
		}
	}
})

export const PageTypeEntries = createCollectionMapping('page_type_entries', PageTypeEntry, manager, {
	subscribe: true,
	links: {}
})

export const PageTypeSymbols = createCollectionMapping('page_type_symbols', PageTypeSymbol, manager, {
	subscribe: true,
	links: {}
})

export const PageTypeSections = createCollectionMapping('page_type_sections', PageTypeSection, manager, {
	subscribe: true,
	links: {
		entries() {
			return PageTypeSectionEntries.from(this.collection.instance).list({ filter: { section: this.id } })
		}
	}
})

export const PageTypeSectionEntries = createCollectionMapping('page_type_section_entries', PageTypeSectionEntry, manager, {
	subscribe: true,
	links: {}
})

export const Pages = createCollectionMapping('pages', Page, manager, {
	subscribe: true,
	links: {
		children() {
			return this.collection.list({ filter: { parent: this.id } })?.sort((a, b) => (a.index || 0) - (b.index || 0))
		},
		sections() {
			return PageSections.from(this.collection.instance)
				.list({ filter: { page: this.id } })
				?.sort((a, b) => a.index - b.index)
		},
		entries() {
			return PageEntries.from(this.collection.instance).list({ filter: { page: this.id } })
		}
	}
})

export const PageEntries = createCollectionMapping('page_entries', PageEntry, manager, {
	subscribe: true,
	links: {}
})

export const PageSections = createCollectionMapping('page_sections', PageSection, manager, {
	subscribe: true,
	links: {
		entries() {
			return PageSectionEntries.from(this.collection.instance).list({ filter: { section: this.id } })
		}
	}
})

export const PageSectionEntries = createCollectionMapping('page_section_entries', PageSectionEntry, manager, {
	subscribe: true,
	links: {}
})

export const SiteUploads = createCollectionMapping('site_uploads', SiteUpload, manager, {
	subscribe: true,
	links: {}
})
