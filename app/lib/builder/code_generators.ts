import { processors } from './component.js'
import { getContent } from '../pocketbase/content.js'
import { type locales } from '$lib/common/constants.js'
import type { Site } from '$lib/common/models/Site.js'
import type { Page } from '$lib/common/models/Page.js'
import type { SiteField } from '$lib/common/models/SiteField.js'
import type { PageTypeField } from '$lib/common/models/PageTypeField.js'
import type { SiteSymbolField } from '$lib/common/models/SiteSymbolField.js'
import { PageSection } from '$lib/common/models/PageSection.js'
import type { PageTypeSection } from '$lib/common/models/PageTypeSection.js'
import type { SiteEntry } from '$lib/common/models/SiteEntry.js'
import type { PageTypeEntry } from '$lib/common/models/PageTypeEntry.js'
import type { PageType } from '$lib/common/models/PageType.js'
import type { PageSectionEntry } from '$lib/common/models/PageSectionEntry.js'
import type { PageTypeSectionEntry } from '$lib/common/models/PageTypeSectionEntry.js'
import type { PageTypeSymbol } from '$lib/common/models/PageTypeSymbol.js'
import type { SiteSymbol } from '$lib/common/models/SiteSymbol.js'
import type { SiteSymbolEntry } from '$lib/common/models/SiteSymbolEntry.js'
import type { PageEntry } from '$lib/common/models/PageEntry.js'
import type { SiteUpload } from '$lib/common/models/SiteUpload.js'

export async function block_html({ code, data }) {
	const { html, css: postcss, js } = code
	// @ts-ignore
	const { css, error } = await processors.css(postcss || '')
	const res = await processors.html({
		component: { html, css, js, data },
		css: 'injected'
	})
	return res
}

export async function page_html({
	site,
	page,
	page_type,
	page_sections,
	page_type_sections,
	page_type_symbols,
	symbols,
	site_fields,
	page_type_fields,
	symbol_fields,
	site_entries,
	page_type_entries,
	page_section_entries,
	page_type_section_entries,
	site_uploads,
	locale = 'en',
	no_js = false
}: {
	site: Site
	page: Page
	page_type: PageType
	page_sections: PageSection[]
	page_type_sections: PageTypeSection[]
	page_type_symbols: PageTypeSymbol[]
	symbols: SiteSymbol[]
	site_fields: SiteField[]
	page_type_fields: PageTypeField[]
	symbol_fields: SiteSymbolField[]
	site_entries: SiteEntry[]
	page_type_entries: PageTypeEntry[]
	symbol_entries: SiteSymbolEntry[]
	page_entries: PageEntry[]
	page_section_entries: PageSectionEntry[]
	page_type_section_entries: PageTypeSectionEntry[]
	site_uploads: SiteUpload[]
	locale?: (typeof locales)[number]
	no_js?: boolean
}) {
	const site_content = getContent(site, site_fields, site_entries, site_uploads)
	const page_type_content = getContent(page_type, page_type_fields, page_type_entries, site_uploads)

	// Flatten the content for template variables (extract from locale structure)
	const site_data = {
		...(site_content[locale] || {}),
		...(page_type_content[locale] || {})
	}

	const head = {
		code: site.head + page_type.head,
		data: site_data
	}

	page_sections = page_sections.filter((section) => section.page === page.id)
	page_type_sections = page_type_sections.filter((section) => section.page_type === page_type.id)
	page_type_symbols = page_type_symbols.filter((symbol) => symbol.page_type === page_type.id)

	const header_sections = page_type_sections.filter((section) => section.zone === 'header')
	const footer_sections = page_type_sections.filter((section) => section.zone === 'footer')
	const page_type_body_sections = page_type_sections.filter((section) => section.zone === 'body')
	const body_sections = page_type_symbols.length === 0 || page_sections.length === 0 ? page_type_body_sections : page_sections

	const sections = [...header_sections, ...body_sections, ...footer_sections].filter(deduplicate('id'))
	const section_entries = [...page_type_section_entries, ...page_section_entries].filter((entry) => sections.some((section) => section.id === entry.section)).filter(deduplicate('id'))

	const component = (
		await Promise.all(
			sections.map(async (section: PageTypeSection | PageSection) => {
				const symbol = symbols.find((symbol) => symbol.id === section.symbol)
				if (!symbol) return []

				const { html, css: postcss, js } = symbol

				const data = getContent(section, symbol_fields, section_entries, site_uploads)[locale] ?? {}

				// @ts-ignore
				const { css, error } = await processors.css(postcss || '')
				return [
					{
						html: `<div data-section="${section.id}" id="section-${section.id}" data-symbol="${symbol.id}">${html}</div>`,
						js,
						css,
						data
					}
				]
			})
		)
	).flat()

	const res = await processors.html({
		component,
		head,
		locale,
		css: 'external'
	})

	const page_symbols_with_js = sections
		.map((section) => section.symbol)
		.filter(deduplicate)
		.map((symbol_id) => symbols.find((symbol) => symbol.id === symbol_id))
		.filter((symbol) => !!symbol)
		.filter((symbol) => symbol.js)
	no_js ||= page_symbols_with_js.length === 0

	const final =
		`<!DOCTYPE html><html lang="${locale}"><head><meta name="generator" content="PalaCMS" />` +
		res.head +
		'</head><body id="page">' +
		res.body +
		(no_js ? `` : '<script type="module">' + 'import { hydrate } from "https://esm.sh/svelte";' + fetch_modules(page_symbols_with_js) + '</script>') +
		site.foot +
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
							const instance_content = getContent(section, symbol_fields, section_entries, site_uploads)[locale]
							return `hydrate(App, { target: document.querySelector('#section-${section.id}'), props: ${JSON.stringify(instance_content)} });`
						})
						.join('') +
					'}).catch(e => console.error(e));'
			)
			.join('')
	}
}

const deduplicate =
	<T>(key: keyof T) =>
	(item: T, index: number, array: T[]) =>
		array.findIndex((value) => value[key] === item[key]) === index
