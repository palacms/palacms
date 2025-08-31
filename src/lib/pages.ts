import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'
import { Pages, Sites } from './pocketbase/collections'

/**
 * Resove page from path
 *
 * This function should be called reactively (eg. inside $deferred).
 *
 * @param site Site the pages should belong in
 * @param path Path segements
 * @returns Resolved page
 */
export const resolve_page = (site: ObjectOf<typeof Sites>, path: string[]) => {
	if (!site || !path) {
		return
	}

	let page = site.homepage()
	if (!page) {
		return
	}

	for (const slug of path) {
		page = Pages.list({
			filter: {
				site: site.id,
				slug,
				parent: page.id
			}
		})?.[0]
		if (!page) {
			return
		}
	}

	return page
}

/**
 * Build page editing URL
 *
 * This function should be called reactively (eg. inside $deferred).
 */
export const build_cms_page_url = (page: ObjectOf<typeof Pages>, current_url: URL) => {
	let path: string[] = []
	let current_page: ObjectOf<typeof Pages> | undefined | null = page
	while (current_page?.parent) {
		path.push(current_page.slug)
		current_page = Pages.one(current_page.parent)
		console.log(current_page?.parent)
	}

	const base_path = current_url.pathname.includes('/sites/') ? `/admin/sites/${page.site}` : '/admin/site'
	path.push(base_path)

	return new URL(path.reverse().join('/'), current_url)
}
