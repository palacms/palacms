import { Context } from 'runed'
import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
import type { Sites, Pages, PageTypes } from '$lib/pocketbase/collections'

// Define typed contexts
export const site_context = new Context<ObjectOf<typeof Sites>>('site')
export const page_context = new Context<ObjectOf<typeof Pages>>('page')
export const page_type_context = new Context<ObjectOf<typeof PageTypes>>('page_type')