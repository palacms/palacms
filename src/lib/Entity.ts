import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'
import { Sites, Pages, PageTypes, SiteSymbols, LibrarySymbols, PageTypeSections, PageSections } from './pocketbase/collections'

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

export const identify_entity_collection = <Collection extends keyof typeof ENTITY_COLLECTIONS>(entity: EntityOf<Collection>): Collection => {
	switch (true) {
		case 'group' in entity && 'html' in entity: {
			return 'library_symbols' as Collection
		}

		case 'host' in entity: {
			return 'sites' as Collection
		}

		case 'html' in entity: {
			return 'site_symbols' as Collection
		}

		case 'head' in entity: {
			return 'page_types' as Collection
		}

		case 'slug' in entity: {
			return 'pages' as Collection
		}

		case 'page_type' in entity && 'symbol' in entity: {
			return 'page_type_sections' as Collection
		}

		case 'page' in entity && 'symbol' in entity: {
			return 'page_sections' as Collection
		}

		default: {
			throw new Error('Unknown entity')
		}
	}
}

export const is_entity_of = <Collection extends keyof typeof ENTITY_COLLECTIONS>(entity: Entity, collection: Collection): entity is EntityOf<Collection> => {
	return identify_entity_collection(entity) === collection
}
