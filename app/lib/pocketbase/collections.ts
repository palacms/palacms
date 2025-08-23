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
import { SiteRoleAssignment } from '$lib/common/models/SiteRoleAssignment'
import { SiteSymbol } from '$lib/common/models/SiteSymbol'
import { SiteSymbolEntry } from '$lib/common/models/SiteSymbolEntry'
import { SiteSymbolField } from '$lib/common/models/SiteSymbolField'
import { User } from '$lib/common/models/User'
import { createCollectionManager } from './CollectionManager'
import { createCollectionMapping } from './CollectionMapping.svelte'

export const manager = createCollectionManager()

export const Users = createCollectionMapping('users', User, manager, {
	links: {
		site_groups() {
			return SiteGroups.list()
		},
		site_role_assignments() {
			return SiteRoleAssignments.list({ filter: `user = "${this.id}"` })
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
			return LibrarySymbolEntries.from(this.collection.instance).list({ filter: `field.symbol = "${this.id}"` })
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
		role_assignments() {
			return SiteRoleAssignments.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
		},
		symbols() {
			return SiteSymbols.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
		},
		fields() {
			return SiteFields.from(this.collection.instance).list({ filter: `site = "${this.id}"` })
		},
		entries() {
			return SiteEntries.from(this.collection.instance).list({ filter: `field.site = "${this.id}"` })
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

export const SiteRoleAssignments = createCollectionMapping('site_role_assignments', SiteRoleAssignment, manager, {
	links: {}
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
			return SiteSymbolEntries.from(this.collection.instance).list({ filter: `field.symbol = "${this.id}"` })
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
			return PageTypeEntries.from(this.collection.instance).list({ filter: `field.page_type = "${this.id}"` })
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
			return this.collection.list({ filter: `parent = "${this.id}"` })?.filter(({ parent }) => parent === this.id)?.sort((a, b) => (a.index || 0) - (b.index || 0))
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
