import * as _ from 'lodash-es'
import { customAlphabet } from 'nanoid/non-secure'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js' // https://highlightjs.org
import { generateHTML, generateJSON } from '@tiptap/core'
import { rich_text_extensions } from '$lib/builder/rich-text/extensions'

import { processors } from './component.js'

const componentsCache = new Map()
const errorCache = new Map()
const CACHE_SIZE_LIMIT = 100

export async function processCode({ component, head = { code: '', data: {} }, buildStatic = true, format = 'esm', locale = 'en', hydrated = true }) {
	let css = ''
	if (component.css) {
		css = await processCSS(component.css || '')
	}

	const res = await processors.html({
		component: {
			...component,
			css
		},
		head,
		buildStatic,
		css: 'injected',
		format,
		locale,
		hydrated
	})
	return res
}

const css_cache = new Map()
let requesting = new Set()
export async function processCSS(raw) {
	if (css_cache.has(raw)) {
		return css_cache.get(raw)
	} else if (requesting.has(raw)) {
		// idk what this was doing
		// await new Promise((resolve) => {
		// 	setTimeout(resolve, 200)
		// })
		if (css_cache.has(raw)) {
			return css_cache.get(raw)
		}
	}

	let res
	try {
		requesting.add(raw)
		res = (await processors.css(raw)) || {}
	} catch (e) {
		console.error(e)
	}
	if (!res) {
		return ''
	} else if (res.error) {
		console.log('CSS Error:', res.error)
		return raw
	} else if (res.css) {
		css_cache.set(raw, res.css)
		requesting.delete(raw)
		return res.css
	}
}

// Lets us debounce from reactive statements
export function createDebouncer(time) {
	return _.debounce((val) => {
		const [fn, arg] = val
		fn(arg)
	}, time)
}

export function wrapInStyleTags(css, id) {
	return `<style type="text/css" ${id ? `id = "${id}"` : ''}>${css}</style>`
}

export function get_empty_value(field) {
	if (field.type === 'repeater') return null
	else if (field.type === 'group') return null
	else if (field.type === 'image')
		return {
			url: '',
			src: '',
			alt: '',
			size: null
		}
	else if (field.type === 'text') return ''
	else if (field.type === 'markdown') return ''
	else if (field.type === 'rich-text')
		return {
			type: 'doc',
			content: [{ type: 'paragraph' }]
		}
	else if (field.type === 'link')
		return {
			label: '',
			url: ''
		}
	else if (field.type === 'url') return ''
	else if (field.type === 'select') return ''
	else if (field.type === 'switch') return true
	else if (field.type === 'number') return 0
	else if (field.type === 'page-field') return null
	else if (field.type === 'site-field') return null
	else {
		console.warn('No placeholder set for field type', field.type)
		return ''
	}
}
let markdown_renderer
function get_markdown_renderer() {
	if (!markdown_renderer) {
		markdown_renderer = new MarkdownIt({
			html: true,
			linkify: true,
			typographer: true,
			highlight: function (str, lang) {
				if (lang && hljs.getLanguage(lang)) {
					try {
						return '<pre><code class="hljs">' + hljs.highlight(str, { language: lang, ignoreIllegals: true }).value + '</code></pre>'
					} catch (__) {}
				}

				return '<pre><code class="hljs">' + markdown_renderer.utils.escapeHtml(str) + '</code></pre>'
			}
		})
	}
	return markdown_renderer
}

const markdown_cache = new Map()
export function convert_markdown_to_html(markdown = '') {
	if (markdown_cache.has(markdown)) return markdown_cache.get(markdown)
	try {
		const html = get_markdown_renderer().render(markdown)
		markdown_cache.set(markdown, html)
		return html
	} catch (error) {
		console.error('Failed to convert markdown to html', error)
		return ''
	}
}

const rich_text_cache = new Map()
export function convert_rich_text_to_html(tiptap_obj) {
	if (rich_text_cache.has(tiptap_obj)) return rich_text_cache.get(tiptap_obj)
	try {
		// Check if tiptap_obj is a string instead of a proper TipTap object
		let processed_obj = tiptap_obj
		if (typeof tiptap_obj === 'string') {
			// Assume it's markdown and convert to HTML first, then to TipTap JSON
			const html = convert_markdown_to_html(tiptap_obj)
			processed_obj = generateJSON(html, rich_text_extensions)
		}

		const html = generateHTML(processed_obj, rich_text_extensions)
		rich_text_cache.set(tiptap_obj, html)
		return html
	} catch (error) {
		console.error('Failed to render rich text content', { error, tiptap_obj })
		return ''
	}
}

export function is_regex(str) {
	return /^\/.*\/$/.test(str)
}

export function createUniqueID(length = 5) {
	const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length)
	return nanoid()
}

export function compare_urls(url1, url2) {
	// Function to decode and normalize a URL
	function normalize_url(url) {
		// Decode the URL
		let decoded = decodeURIComponent(url)
		// Trim whitespace
		decoded = decoded.trim()
		// Remove any surrounding quotes
		decoded = decoded.replace(/^["']|["']$/g, '')
		// Normalize spaces in the path
		return decoded.replace(/ /g, '%20')
	}

	const normalizedURL1 = normalize_url(url1)
	const normalizedURL2 = normalize_url(url2)

	// Compare the normalized URLs
	return normalizedURL1 === normalizedURL2
}

export function debounce({ instant, delay }, wait = 200) {
	let timeout
	return (...args) => {
		instant(...args)
		clearTimeout(timeout)
		timeout = setTimeout(() => delay(...args), wait)
	}
}
