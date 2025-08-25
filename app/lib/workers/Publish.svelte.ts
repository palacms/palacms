import { page_html } from '../builder/code_generators'
import { processors } from '../builder/component'
import { usePageData } from '../PageData.svelte'
import { PageTypes, Sites } from '../pocketbase/collections'
import { self } from '../pocketbase/PocketBase'
import { useSvelteWorker } from './Worker.svelte'

export const usePublishSite = (site_id?: string) => {
	const worker = useSvelteWorker(
		() => !!site_id,
		() => !!site && !!pages && !!data,
		async () => {
			if (!data) {
				throw new Error('Not loaded')
			}

			const promises: Promise<void>[] = []
			for (const symbol of data.symbols) {
				if (!symbol.js) {
					// No need to compile symbol JavaScript if there's none
					continue
				}

				const promise = processors
					.html({
						component: {
							html: symbol.html,
							js: symbol.js,
							css: symbol.css,
							data: {}
						},
						buildStatic: false,
						css: 'external'
					})
					.then(async (res) => {
						if (!res.js) {
							throw new Error('Compiling symbol not successful')
						}

						await self.collection('site_symbols').update(symbol.id, {
							compiled_js: new File([res.js], 'symbol.js', { type: 'text/javascript' })
						})
					})
				promises.push(promise)
			}

			for (const page of data.pages) {
				if (!page.parent) {
					// Generate site preview from homepage
					const promise = page_html({
						...data,
						page,
						page_type: PageTypes.one(page.page_type)!,
						no_js: true
					}).then(async ({ success, html }) => {
						if (!success) {
							throw new Error('Generating site preview not successful')
						}
						if (!site) {
							throw new Error('No site')
						}

						await self.collection('sites').update(site.id, {
							preview: new File([html], 'index.html')
						})
					})
					promises.push(promise)
				}

				const promise = page_html({
					...data,
					page,
					page_type: PageTypes.one(page.page_type)!
				})
					.then(async ({ success, html }) => {
						if (!success) {
							throw new Error('Generating page not successful')
						}

						await self.collection('pages').update(page.id, {
							compiled_html: new File([html], 'index.html', { type: 'text/html' })
						})
					})
					.catch((error) => {
						console.error('Page compilation error:', error)
						throw error // Re-throw to be caught by Promise.all
					})
				promises.push(promise)
			}

			await Promise.all(promises)
		}
	)

	const shouldLoad = ['loading', 'working'].includes(worker.status)
	const site = $derived(shouldLoad && site_id ? Sites.one(site_id) : undefined)
	const pages = $derived(shouldLoad && site ? site.pages() : undefined)
	const { data } = $derived(shouldLoad && site && pages ? usePageData(site, pages) : { data: undefined })

	return worker
}
