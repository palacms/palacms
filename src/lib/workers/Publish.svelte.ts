import type { Page } from '$lib/common/models/Page'
import type { PageSection } from '$lib/common/models/PageSection'
import type { PageTypeSection } from '$lib/common/models/PageTypeSection'
import type { SiteSymbol } from '$lib/common/models/SiteSymbol'
import { useContent } from '$lib/Content.svelte'
import { processors } from '../builder/component'
import { usePageData } from '../PageData.svelte'
import { Sites } from '../pocketbase/collections'
import { self } from '../pocketbase/PocketBase'
import { useSvelteWorker } from './Worker.svelte'

export const usePublishSite = (site_id?: string) => {
	const worker = useSvelteWorker(
		() => !!site_id,
		() => !!site && !!pages && !!page_types && !!data && !!site_content && !!page_type_content && !!section_content,
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
					const promise = generate_page(page, true).then(async ({ success, html }) => {
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

				const promise = generate_page(page)
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
			await fetch(new URL('/api/palacms/generate', self.baseURL), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ site_id })
			}).then((res) => {
				if (!res.ok) {
					throw new Error('Failed to generate site: Not OK response')
				}
			})
		}
	)

	const generate_page = async (page: Page, no_js = false) => {
		const locale = 'en' as const

		const page_type = page_types?.find((page_type) => page_type.id === page.page_type)
		const page_sections = data?.page_sections.filter((section) => section.page === page.id)
		const page_type_sections = data?.page_type_sections.filter((section) => section.page_type === page_type?.id)
		const page_type_symbols = data?.page_type_symbols.filter((symbol) => symbol.page_type === page_type?.id)

		const header_sections = page_type_sections?.filter((section) => section.zone === 'header')
		const footer_sections = page_type_sections?.filter((section) => section.zone === 'footer')
		const page_type_body_sections = page_type_sections?.filter((section) => section.zone === 'body')
		const body_sections = page_type_symbols?.length === 0 || page_sections?.length === 0 ? page_type_body_sections : page_sections

		const sections = [...(header_sections ?? []), ...(body_sections ?? []), ...(footer_sections ?? [])].filter(deduplicate('id'))

		const component = (
			await Promise.all(
				sections.map(async (section: PageTypeSection | PageSection) => {
					const symbol = data?.symbols.find((symbol) => symbol.id === section.symbol)
					if (!symbol) return []

					const { html, css: postcss, js } = symbol

					const content = section_content?.[section.id]?.[locale] ?? {}
					const { css } = await processors.css(postcss || '')
					return [
						{
							html: `<div data-section="${section.id}" id="section-${section.id}" data-symbol="${symbol.id}">${html}</div>`,
							js,
							css,
							data: content
						}
					]
				})
			)
		).flat()

		const site_data = {
			...site_content?.[locale],
			...page_type_content?.[page.page_type]?.[locale]
		}

		const head = {
			code: (site?.head ?? '') + (page_type?.head ?? ''),
			data: site_data
		}

		const res = await processors.html({
			component,
			head,
			locale,
			css: 'external'
		})

		const page_symbols_with_js = sections
			.map((section) => section.symbol)
			.filter(deduplicate)
			.map((symbol_id) => data?.symbols.find((symbol) => symbol.id === symbol_id))
			.filter((symbol) => !!symbol)
			.filter((symbol) => symbol.js)
		no_js ||= page_symbols_with_js.length === 0

		const final =
			`<!DOCTYPE html><html lang="${locale}"><head><meta name="generator" content="PalaCMS" />` +
			res.head +
			'</head><body id="page">' +
			res.body +
			(no_js ? `` : '<script type="module">' + 'import { hydrate } from "https://esm.sh/svelte";' + fetch_modules(page_symbols_with_js) + '</script>') +
			site?.foot +
			'</body></html>'

		return {
			success: !!res.body,
			html: final,
			js: res.js
		}

		// fetch module to hydrate component, include hydration data
		function fetch_modules(symbols: SiteSymbol[]) {
			return symbols
				.map(
					(symbol) =>
						`import('/_symbols/${symbol.id}.js').then(({ default: App }) => {` +
						sections
							.filter((section) => section.symbol === symbol.id)
							.map((section) => {
								const content = section_content?.[section.id][locale]
								return `hydrate(App, { target: document.querySelector('#section-${section.id}'), props: ${JSON.stringify(content)} });`
							})
							.join('') +
						'}).catch(e => console.error(e));'
				)
				.join('')
		}
	}

	const shouldLoad = $derived(['loading', 'working'].includes(worker.status))
	const site = $derived(shouldLoad && site_id ? Sites.one(site_id) : undefined)
	const pages = $derived(shouldLoad && site ? site.pages() : undefined)
	const page_types = $derived(shouldLoad && site ? site.page_types() : undefined)

	const { data } = $derived(shouldLoad && site && pages ? usePageData(site, pages) : { data: undefined })

	const site_content = $derived(shouldLoad && site ? useContent(site) : undefined)
	const page_type_content = $derived(shouldLoad && page_types ? Object.fromEntries(page_types.map((page_type) => [page_type.id, useContent(page_type)])) : undefined)
	const section_content = $derived(shouldLoad && data ? Object.fromEntries([...data.page_type_sections, ...data.page_sections].map((section) => [section.id, useContent(section)])) : undefined)

	return worker
}

const deduplicate =
	<T>(key: keyof T) =>
	(item: T, index: number, array: T[]) =>
		array.findIndex((value) => value[key] === item[key]) === index
