import type { Page } from '$lib/common/models/Page'
import type { PageSection } from '$lib/common/models/PageSection'
import type { PageTypeSection } from '$lib/common/models/PageTypeSection'
import type { SiteSymbol } from '$lib/common/models/SiteSymbol'
import { useContent } from '$lib/Content.svelte'
import { processors } from '../builder/component'
import { usePageData } from '../PageData.svelte'
import { Sites } from '../pocketbase/collections'
import { self } from '../pocketbase/managers'
import { useSvelteWorker } from './Worker.svelte'

export const usePublishSite = (site_id?: string) => {
	const worker = useSvelteWorker(
		() => !!site_id,
		() => !!site && !!pages && !!page_types && !!data && !!site_content && !!page_type_content,
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

				const locale = 'en' as const
				const { css } = await processors.css(symbol.css || '')
				const promise = processors
					.html({
						component: {
							html: symbol.html,
							js: symbol.js,
							css,
							data: symbol_content?.[symbol.id]?.[locale] ?? {}
						},
						buildStatic: false,
						css: 'external',

						// TODO: Svelte runtime needs to be in common bundle shared by all symbol modules.
						runtime: ['hydrate']
					})
					.then(async (res) => {
						if (res.error) {
							console.error(`Symbol compilation error for "${symbol.name || symbol.id}":`, res.error)
							throw new Error(`Compiling symbol "${symbol.name || symbol.id}" failed: ${res.error}`)
						}
						if (!res.js) {
							console.error(`Symbol compilation failed for "${symbol.name || symbol.id}": No JavaScript output`)
							throw new Error(`Compiling symbol "${symbol.name || symbol.id}" not successful: No JavaScript output`)
						}

						await self.instance.collection('site_symbols').update(symbol.id, {
							compiled_js: new File([res.js], 'symbol.js', { type: 'text/javascript' })
						})
					})
					.catch((error) => {
						console.error(`Failed to compile symbol "${symbol.name || symbol.id}":`, error)
						throw error // Re-throw to be caught by Promise.all
					})
				promises.push(promise)
			}

			for (const page of data.pages) {
				if (!page.parent) {
					// Generate site preview from homepage
					const promise = generate_page(page, true).then(async ({ success, html, error }) => {
						if (!success) {
							console.error(`Site preview generation failed for page "${page.name || page.id}":`, error || 'Unknown error')
							throw new Error(`Generating site preview not successful for page "${page.name || page.id}": ${error || 'Unknown error'}`)
						}
						if (!site) {
							throw new Error('No site')
						}

						await self.instance.collection('sites').update(site.id, {
							preview: new File([html], 'index.html')
						})
					})
					promises.push(promise)
				}

				const promise = generate_page(page)
					.then(async ({ success, html, error, page_info }) => {
						if (!success) {
							console.error(`Page generation failed for "${page.name || page.id}":`, {
								page_id: page.id,
								page_name: page.name,
								page_slug: page.slug,
								error: error || 'Unknown error',
								...page_info
							})
							throw new Error(`Generating page "${page.name || page.id}" (${page.slug || '/'}) not successful: ${error || 'Unknown error'}`)
						}

						await self.instance.collection('pages').update(page.id, {
							compiled_html: new File([html], 'index.html', { type: 'text/html' })
						})
					})
					.catch((error) => {
						console.error(`Page compilation error for "${page.name || page.id}":`, error)
						throw error // Re-throw to be caught by Promise.all
					})
				promises.push(promise)
			}

			await Promise.all(promises)
			await fetch(new URL('/api/palacms/generate', self.instance.baseURL), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${self.instance.authStore.token}`
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
		let error_details = ''
		let page_info: Record<string, any> = {}

		try {
			const page_type = page_types?.find((page_type) => page_type.id === page.page_type)
			const page_sections = data?.page_sections.filter((section) => section.page === page.id)
			const page_type_sections = data?.page_type_sections.filter((section) => section.page_type === page_type?.id)

			const header_sections = page_type_sections?.filter((section) => section.zone === 'header')
			const footer_sections = page_type_sections?.filter((section) => section.zone === 'footer')
			const body_sections = page_sections

			const sections = [...(header_sections ?? []), ...(body_sections ?? []), ...(footer_sections ?? [])].filter(deduplicate('id'))

			page_info = {
				page_type: page_type?.name || page.page_type,
				sections_count: sections.length,
				section_ids: sections.map((s) => s.id)
			}

			console.log(`Generating page "${page.name || page.id}" with ${sections.length} sections`)

			// Compute section content for this specific page (needed for link active state)
			const section_content = Object.fromEntries(sections.map((section) => [section.id, useContent(section, { target: 'live' })]).filter(([_, content]) => !!content))

			const component = (
				await Promise.all(
					sections.map(async (section: PageTypeSection | PageSection, index: number) => {
						try {
							const symbol = data?.symbols.find((symbol) => symbol.id === section.symbol)
							if (!symbol) {
								console.warn(`Section ${index} (${section.id}) references missing symbol: ${section.symbol}`)
								return []
							}

							const { html, css: postcss, js } = symbol

							const { css } = await processors.css(postcss || '')
							return [
								{
									html,
									js,
									css,
									data: section_content?.[section.id]?.[locale] ?? {},
									wrapper_start: `<div data-section="${section.id}" id="section-${section.id}" data-symbol="${symbol.id}">`,
									wrapper_end: '</div>'
								}
							]
						} catch (section_error) {
							console.error(`Error processing section ${index} (${section.id}):`, section_error)
							throw new Error(`Failed to process section ${index} (${section.id}): ${section_error}`)
						}
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

			console.log(`Compiling HTML for page "${page.name || page.id}"`)

			const res = await processors.html({
				component,
				head,
				locale,
				css: 'external'
			})

			if (res.error) {
				error_details = `HTML compilation error: ${res.error}`
				console.error(`HTML compilation error for page "${page.name || page.id}":`, res.error)
				return {
					success: false,
					html: '',
					js: '',
					error: error_details,
					page_info
				}
			}

			if (!res.body) {
				error_details = 'HTML compilation produced no body output'
				console.error(`HTML compilation for page "${page.name || page.id}" produced no body output`)
				return {
					success: false,
					html: '',
					js: '',
					error: error_details,
					page_info
				}
			}

			const page_symbols_with_js = sections
				.map((section) => ({ symbol_id: section.symbol }))
				.filter(deduplicate('symbol_id'))
				.map(({ symbol_id }) => data?.symbols.find((symbol) => symbol.id === symbol_id))
				.filter((symbol) => !!symbol)
				.filter((symbol) => !!symbol.js)
			no_js ||= page_symbols_with_js.length === 0

			// fetch module to hydrate component, include hydration data
			function fetch_modules(symbols: SiteSymbol[]) {
				return symbols
					.map(
						(symbol) =>
							`import('/_symbols/${symbol.id}.js').then(({ default: App, hydrate }) => {` +
							sections
								.filter((section) => section.symbol === symbol.id)
								.map((section) => {
									const content = section_content?.[section.id]?.[locale]
									return `hydrate(App, { target: document.querySelector('#section-${section.id}'), props: ${JSON.stringify(content)} });`
								})
								.join('') +
							'}).catch(e => console.error(e));'
					)
					.join('')
			}

			const final =
				`<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="generator" content="Pala" />` +
				res.head +
				'</head><body id="page">' +
				res.body +
				(no_js ? `` : '<script type="module">' + fetch_modules(page_symbols_with_js) + '</script>') +
				site?.foot +
				'</body></html>'

			console.log(`Successfully generated page "${page.name || page.id}"`)

			return {
				success: !!res.body,
				html: final,
				js: res.js,
				error: '',
				page_info
			}
		} catch (e) {
			error_details = e instanceof Error ? e.message : String(e)
			console.error(`Fatal error generating page "${page.name || page.id}":`, e)
			return {
				success: false,
				html: '',
				js: '',
				error: error_details,
				page_info
			}
		}
	}

	const shouldLoad = $derived(['loading', 'working'].includes(worker.status))
	const site = $derived(shouldLoad && site_id ? Sites.one(site_id) : undefined)
	const pages = $derived(shouldLoad && site ? site.pages() : undefined)
	const page_types = $derived(shouldLoad && site ? site.page_types() : undefined)

	const { data } = $derived(shouldLoad && site && pages ? usePageData(site, pages) : { data: undefined })

	const site_content = $derived(shouldLoad && site ? useContent(site, { target: 'live' }) : undefined)
	const page_type_content = $derived(
		shouldLoad && page_types && page_types.every((page_type) => !!useContent(page_type, { target: 'live' }))
			? Object.fromEntries(page_types.map((page_type) => [page_type.id, useContent(page_type, { target: 'live' })]))
			: undefined
	)
	const symbol_content = $derived(
		shouldLoad && data && data.symbols.every((symbol) => !!useContent(symbol, { target: 'live' }))
			? Object.fromEntries(data.symbols.map((symbol) => [symbol.id, useContent(symbol, { target: 'live' })]))
			: undefined
	)

	return worker
}

const deduplicate =
	<T>(key: keyof T) =>
		(item: T, index: number, array: T[]) =>
			array.findIndex((value) => value[key] === item[key]) === index
