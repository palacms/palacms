/**
 * HTML to Pala Converter - Converts HTML content into Pala components
 */

import type { FetchedSite, FetchedPage } from './site-fetcher'
import { v4 as uuidv4 } from 'uuid'

interface PalaComponent {
	id: string
	name: string
	html: string
	css: string
	js: string
	fields: any[]
}

interface PalaPage {
	id: string
	name: string
	slug: string
	sections: any[]
	parent?: string
}

interface PalaSite {
	id: string
	name: string
	pages: PalaPage[]
	symbols: PalaComponent[]
	styles: string
	scripts: string
}

export class HtmlToPalaConverter {
	private site: FetchedSite
	private componentMap: Map<string, PalaComponent> = new Map()
	
	constructor(site: FetchedSite) {
		this.site = site
	}
	
	convert(): PalaSite {
		// Create base site structure
		const palaSite: PalaSite = {
			id: uuidv4(),
			name: this.site.domain.replace(/\./g, '_'),
			pages: [],
			symbols: [],
			styles: this.site.globalStyles,
			scripts: this.site.globalScripts
		}
		
		// Convert each page
		for (const page of this.site.pages) {
			const palaPage = this.convertPage(page)
			palaSite.pages.push(palaPage)
		}
		
		// Add all unique components
		palaSite.symbols = Array.from(this.componentMap.values())
		
		// Organize page hierarchy
		this.organizePageHierarchy(palaSite.pages)
		
		return palaSite
	}
	
	private convertPage(page: FetchedPage): PalaPage {
		const parser = new DOMParser()
		const doc = parser.parseFromString(page.html, 'text/html')
		
		// Extract page name from title or path
		const name = page.title || this.pathToName(page.path)
		
		// Convert path to slug
		const slug = this.pathToSlug(page.path)
		
		// Extract main content sections
		const sections = this.extractSections(doc, page)
		
		return {
			id: uuidv4(),
			name,
			slug,
			sections
		}
	}
	
	private extractSections(doc: Document, page: FetchedPage): any[] {
		const sections: any[] = []
		const body = doc.body
		
		// Try to identify logical sections
		const sectionElements = this.identifySections(body)
		
		for (const element of sectionElements) {
			const component = this.elementToComponent(element, page)
			if (component) {
				sections.push({
					id: uuidv4(),
					symbol: component.id,
					content: {}
				})
			}
		}
		
		// If no sections found, treat entire body as one section
		if (sections.length === 0) {
			const component = this.elementToComponent(body, page)
			if (component) {
				sections.push({
					id: uuidv4(),
					symbol: component.id,
					content: {}
				})
			}
		}
		
		return sections
	}
	
	private identifySections(body: HTMLElement): HTMLElement[] {
		const sections: HTMLElement[] = []
		
		// Look for semantic HTML5 sections
		const semanticSections = body.querySelectorAll('header, nav, main, section, article, aside, footer')
		if (semanticSections.length > 0) {
			semanticSections.forEach(section => {
				sections.push(section as HTMLElement)
			})
			return sections
		}
		
		// Look for divs with common section class names
		const sectionPatterns = [
			'section', 'container', 'wrapper', 'content',
			'header', 'footer', 'hero', 'banner'
		]
		
		for (const pattern of sectionPatterns) {
			const divs = body.querySelectorAll(`div[class*="${pattern}"]`)
			if (divs.length > 0) {
				divs.forEach(div => {
					// Only add top-level sections
					if (!this.hasParentWithPattern(div as HTMLElement, sectionPatterns)) {
						sections.push(div as HTMLElement)
					}
				})
			}
		}
		
		// If still no sections, try to split by direct children of body
		if (sections.length === 0) {
			Array.from(body.children).forEach(child => {
				if (child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
					sections.push(child as HTMLElement)
				}
			})
		}
		
		return sections
	}
	
	private hasParentWithPattern(element: HTMLElement, patterns: string[]): boolean {
		let parent = element.parentElement
		while (parent && parent !== document.body) {
			const className = parent.className || ''
			for (const pattern of patterns) {
				if (className.includes(pattern)) {
					return true
				}
			}
			parent = parent.parentElement
		}
		return false
	}
	
	private elementToComponent(element: HTMLElement, page: FetchedPage): PalaComponent | null {
		// Generate a hash of the element structure for deduplication
		const hash = this.hashElement(element)
		
		// Check if we already have this component
		if (this.componentMap.has(hash)) {
			return this.componentMap.get(hash)!
		}
		
		// Clean up the HTML
		const html = this.cleanHtml(element)
		
		// Extract component-specific styles
		const css = this.extractComponentStyles(element, page)
		
		// Identify dynamic content and create fields
		const { processedHtml, fields, js } = this.extractDynamicContent(html)
		
		// Generate component name
		const name = this.generateComponentName(element)
		
		const component: PalaComponent = {
			id: uuidv4(),
			name,
			html: processedHtml,
			css,
			js,
			fields
		}
		
		this.componentMap.set(hash, component)
		return component
	}
	
	private cleanHtml(element: HTMLElement): string {
		const clone = element.cloneNode(true) as HTMLElement
		
		// Remove scripts
		clone.querySelectorAll('script').forEach(script => script.remove())
		
		// Remove inline styles (we'll handle them separately)
		clone.querySelectorAll('[style]').forEach(el => {
			el.removeAttribute('style')
		})
		
		// Clean up classes (remove framework-specific classes)
		clone.querySelectorAll('[class]').forEach(el => {
			const classes = el.className.split(' ').filter(cls => {
				// Keep semantic classes, remove framework-specific ones
				return !cls.match(/^(js-|ng-|v-|react-)/)
			})
			if (classes.length > 0) {
				el.className = classes.join(' ')
			} else {
				el.removeAttribute('class')
			}
		})
		
		// Convert relative URLs to absolute
		clone.querySelectorAll('img[src], a[href]').forEach(el => {
			const attr = el.tagName === 'IMG' ? 'src' : 'href'
			const value = el.getAttribute(attr)
			if (value && !value.startsWith('http') && !value.startsWith('data:')) {
				el.setAttribute(attr, new URL(value, this.site.url).href)
			}
		})
		
		return clone.outerHTML
	}
	
	private extractComponentStyles(element: HTMLElement, page: FetchedPage): string {
		const styles: string[] = []
		
		// Get classes used in this component
		const classes = new Set<string>()
		element.querySelectorAll('[class]').forEach(el => {
			el.className.split(' ').forEach(cls => classes.add(cls))
		})
		
		// Extract relevant styles from page styles
		page.styles.forEach(styleUrl => {
			if (styleUrl.startsWith('inline:')) {
				// Handle inline styles
				const inlineStyle = styleUrl.substring(7)
				const relevantStyles = this.extractRelevantStyles(inlineStyle, classes)
				if (relevantStyles) {
					styles.push(relevantStyles)
				}
			} else {
				// Handle external styles
				const styleContent = this.site.assets.styles.get(styleUrl)
				if (styleContent) {
					const relevantStyles = this.extractRelevantStyles(styleContent, classes)
					if (relevantStyles) {
						styles.push(relevantStyles)
					}
				}
			}
		})
		
		return styles.join('\n')
	}
	
	private extractRelevantStyles(css: string, classes: Set<string>): string {
		// This is a simplified extraction - in production you'd want a proper CSS parser
		const relevantRules: string[] = []
		
		// Extract rules that match our classes
		const ruleRegex = /([^{]+)\{([^}]+)\}/g
		let match
		
		while ((match = ruleRegex.exec(css)) !== null) {
			const selector = match[1].trim()
			const rules = match[2].trim()
			
			// Check if selector matches any of our classes
			for (const cls of classes) {
				if (selector.includes(`.${cls}`)) {
					relevantRules.push(`${selector} { ${rules} }`)
					break
				}
			}
		}
		
		return relevantRules.join('\n')
	}
	
	private extractDynamicContent(html: string): { processedHtml: string; fields: any[]; js: string } {
		const fields: any[] = []
		let processedHtml = html
		let js = ''
		
		// Look for common dynamic patterns
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, 'text/html')
		
		// Extract text content as fields
		const textElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a')
		textElements.forEach((el, index) => {
			const text = el.textContent?.trim()
			if (text && text.length > 0) {
				const fieldName = `text_${index}`
				const fieldVar = `{${fieldName}}`
				
				fields.push({
					id: uuidv4(),
					key: fieldName,
					label: this.generateFieldLabel(el.tagName, text),
					type: 'text',
					default: text
				})
				
				// Replace in HTML
				processedHtml = processedHtml.replace(text, fieldVar)
			}
		})
		
		// Extract images as fields
		const images = doc.querySelectorAll('img')
		images.forEach((img, index) => {
			const src = img.getAttribute('src')
			if (src) {
				const fieldName = `image_${index}`
				const fieldVar = `{${fieldName}}`
				
				fields.push({
					id: uuidv4(),
					key: fieldName,
					label: `Image ${index + 1}`,
					type: 'image',
					default: src
				})
				
				// Replace in HTML
				processedHtml = processedHtml.replace(src, fieldVar)
			}
		})
		
		return { processedHtml, fields, js }
	}
	
	private hashElement(element: HTMLElement): string {
		// Create a simple hash based on element structure
		const structure = this.getElementStructure(element)
		return this.simpleHash(structure)
	}
	
	private getElementStructure(element: HTMLElement): string {
		const tag = element.tagName
		const classes = element.className
		const childTags = Array.from(element.children)
			.map(child => child.tagName)
			.join(',')
		return `${tag}:${classes}:${childTags}`
	}
	
	private simpleHash(str: string): string {
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = ((hash << 5) - hash) + char
			hash = hash & hash // Convert to 32bit integer
		}
		return hash.toString(36)
	}
	
	private generateComponentName(element: HTMLElement): string {
		// Try to generate a meaningful name
		const tag = element.tagName.toLowerCase()
		const id = element.id
		const classes = element.className.split(' ')[0]
		
		if (id) {
			return this.titleCase(id.replace(/[-_]/g, ' '))
		} else if (classes) {
			return this.titleCase(classes.replace(/[-_]/g, ' '))
		} else {
			return this.titleCase(tag) + ' Section'
		}
	}
	
	private generateFieldLabel(tag: string, text: string): string {
		const tagName = tag.toLowerCase()
		const preview = text.substring(0, 30) + (text.length > 30 ? '...' : '')
		
		if (tagName.startsWith('h')) {
			return `Heading: ${preview}`
		} else if (tagName === 'p') {
			return `Paragraph: ${preview}`
		} else if (tagName === 'a') {
			return `Link: ${preview}`
		} else {
			return `Text: ${preview}`
		}
	}
	
	private pathToName(path: string): string {
		// Convert path to readable name
		const parts = path.split('/').filter(p => p)
		if (parts.length === 0 || parts[0] === 'index') {
			return 'Home'
		}
		return this.titleCase(parts[parts.length - 1].replace(/[-_]/g, ' '))
	}
	
	private pathToSlug(path: string): string {
		// Convert path to slug
		if (path === '/' || path === '/index') {
			return ''
		}
		return path.replace(/^\//, '').replace(/\/index$/, '')
	}
	
	private titleCase(str: string): string {
		return str.replace(/\b\w/g, char => char.toUpperCase())
	}
	
	private organizePageHierarchy(pages: PalaPage[]): void {
		// Organize pages into hierarchy based on their slugs
		pages.forEach(page => {
			if (page.slug.includes('/')) {
				const parts = page.slug.split('/')
				const parentSlug = parts.slice(0, -1).join('/')
				const parent = pages.find(p => p.slug === parentSlug)
				if (parent) {
					page.parent = parent.id
				}
			}
		})
	}
}