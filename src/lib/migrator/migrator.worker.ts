/**
 * Web Worker for Site Migration
 * Runs heavy processing off the main thread
 */

interface WorkerMessage {
	type: 'START_MIGRATION' | 'PROCESS_PAGE' | 'EXTRACT_COMPONENTS'
	data: any
}

interface WorkerResponse {
	type: 'PROGRESS' | 'RESULT' | 'ERROR'
	data: any
}

// Web Worker context
const ctx = self as unknown as Worker

// Component hash map for deduplication
const componentMap = new Map<string, any>()

ctx.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
	const { type, data } = event.data
	
	try {
		switch (type) {
			case 'START_MIGRATION':
				await startMigration(data.url, data.options)
				break
				
			case 'PROCESS_PAGE':
				const processed = await processPage(data.html, data.url)
				ctx.postMessage({ type: 'RESULT', data: processed })
				break
				
			case 'EXTRACT_COMPONENTS':
				const components = extractComponents(data.html)
				ctx.postMessage({ type: 'RESULT', data: components })
				break
		}
	} catch (error) {
		ctx.postMessage({ 
			type: 'ERROR', 
			data: { message: error instanceof Error ? error.message : 'Unknown error' }
		})
	}
})

async function startMigration(url: string, options: any) {
	const { maxPages = 10, maxDepth = 2 } = options
	
	// Send progress update
	ctx.postMessage({ 
		type: 'PROGRESS', 
		data: { message: 'Starting migration...', progress: 0 }
	})
	
	// Fetch the main page through proxy
	const response = await fetch('/api/proxy-fetch', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url })
	})
	
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}`)
	}
	
	const html = await response.text()
	
	// Parse HTML using DOMParser (available in workers!)
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')
	
	// Extract page data
	const pageData = {
		url,
		title: doc.title || 'Untitled',
		meta: extractMetaTags(doc),
		links: extractLinks(doc, url),
		sections: []
	}
	
	// Process components in parallel chunks
	const sections = doc.querySelectorAll('header, nav, main, section, article, aside, footer')
	const totalSections = sections.length
	
	for (let i = 0; i < totalSections; i++) {
		const section = sections[i] as HTMLElement
		const component = await processComponent(section, i, totalSections)
		pageData.sections.push(component)
		
		// Update progress
		const progress = ((i + 1) / totalSections) * 100
		ctx.postMessage({ 
			type: 'PROGRESS', 
			data: { 
				message: `Processing section ${i + 1}/${totalSections}`, 
				progress 
			}
		})
	}
	
	// Send final result
	ctx.postMessage({ 
		type: 'RESULT', 
		data: {
			pages: [pageData],
			components: Array.from(componentMap.values())
		}
	})
}

async function processPage(html: string, url: string) {
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')
	
	// Heavy processing off main thread
	const components = extractComponents(html)
	const styles = extractStyles(doc)
	const assets = extractAssets(doc, url)
	
	return {
		components,
		styles,
		assets
	}
}

function extractComponents(html: string): any[] {
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')
	const components: any[] = []
	
	// Find all semantic sections
	const semanticElements = doc.querySelectorAll('header, nav, main, section, article, aside, footer')
	
	semanticElements.forEach(element => {
		const component = createComponent(element as HTMLElement)
		components.push(component)
	})
	
	// Also look for repeated patterns (like cards)
	const repeatedPatterns = findRepeatedPatterns(doc)
	repeatedPatterns.forEach(pattern => {
		const component = createComponent(pattern)
		components.push(component)
	})
	
	return components
}

function createComponent(element: HTMLElement) {
	const hash = hashElement(element)
	
	// Check if we've seen this component before
	if (componentMap.has(hash)) {
		return componentMap.get(hash)
	}
	
	const fields = extractFields(element)
	const component = {
		id: generateId(),
		name: generateComponentName(element),
		html: processHtml(element, fields),
		css: '', // Would extract scoped styles here
		fields
	}
	
	componentMap.set(hash, component)
	return component
}

function extractFields(element: HTMLElement) {
	const fields: any[] = []
	
	// Smart field extraction
	const contentGroups = analyzeContent(element)
	
	contentGroups.forEach(group => {
		if (group.type === 'repeating') {
			// Repeater field for lists/grids
			fields.push({
				id: generateId(),
				type: 'repeater',
				key: `repeater_${fields.length}`,
				label: 'List Items',
				items: group.items
			})
		} else if (group.type === 'text') {
			// Text fields
			fields.push({
				id: generateId(),
				type: 'text',
				key: `text_${fields.length}`,
				label: group.label,
				value: group.value
			})
		} else if (group.type === 'image') {
			// Image fields
			fields.push({
				id: generateId(),
				type: 'image',
				key: `image_${fields.length}`,
				label: 'Image',
				value: group.src
			})
		}
	})
	
	return fields
}

function analyzeContent(element: HTMLElement) {
	const groups: any[] = []
	
	// Detect repeating structures (like cards, list items)
	const children = Array.from(element.children)
	const signatures = children.map(child => getElementSignature(child))
	
	// Group similar signatures
	const repeatingGroups = findRepeatingGroups(signatures)
	
	repeatingGroups.forEach(group => {
		if (group.count > 2) {
			// It's a repeater
			groups.push({
				type: 'repeating',
				items: group.elements.map(el => extractFieldsFromElement(el))
			})
		}
	})
	
	// Extract standalone text/images
	element.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach(el => {
		if (!isInRepeatingGroup(el, repeatingGroups)) {
			const text = el.textContent?.trim()
			if (text) {
				groups.push({
					type: 'text',
					label: `${el.tagName}: ${text.substring(0, 30)}`,
					value: text
				})
			}
		}
	})
	
	element.querySelectorAll('img').forEach(img => {
		if (!isInRepeatingGroup(img, repeatingGroups)) {
			groups.push({
				type: 'image',
				src: img.getAttribute('src')
			})
		}
	})
	
	return groups
}

function findRepeatedPatterns(doc: Document) {
	const patterns: HTMLElement[] = []
	
	// Look for common patterns like cards, grid items
	const candidates = doc.querySelectorAll('.card, .item, .feature, .service, [class*="grid-item"]')
	
	// Group by structure similarity
	const grouped = new Map<string, HTMLElement[]>()
	
	candidates.forEach(element => {
		const signature = getElementSignature(element)
		if (!grouped.has(signature)) {
			grouped.set(signature, [])
		}
		grouped.get(signature)!.push(element as HTMLElement)
	})
	
	// If we have 3+ similar items, it's a pattern
	grouped.forEach(group => {
		if (group.length >= 3) {
			patterns.push(group[0]) // Use first as template
		}
	})
	
	return patterns
}

function getElementSignature(element: Element): string {
	// Create a signature based on element structure
	const tag = element.tagName
	const childTags = Array.from(element.children).map(c => c.tagName).sort().join(',')
	const classes = element.className.split(' ').sort().join(',')
	return `${tag}:${classes}:${childTags}`
}

function findRepeatingGroups(signatures: string[]) {
	const groups: any[] = []
	const counts = new Map<string, number>()
	
	signatures.forEach(sig => {
		counts.set(sig, (counts.get(sig) || 0) + 1)
	})
	
	counts.forEach((count, signature) => {
		if (count > 2) {
			groups.push({ signature, count, elements: [] })
		}
	})
	
	return groups
}

function isInRepeatingGroup(element: Element, groups: any[]): boolean {
	// Check if element is part of a repeating pattern
	return false // Simplified
}

function extractFieldsFromElement(element: Element) {
	return {
		text: element.textContent?.trim(),
		tag: element.tagName
	}
}

function processHtml(element: HTMLElement, fields: any[]) {
	let html = element.outerHTML
	
	// Replace field values with placeholders
	fields.forEach(field => {
		if (field.type === 'text' && field.value) {
			html = html.replace(field.value, `{${field.key}}`)
		} else if (field.type === 'image' && field.value) {
			html = html.replace(field.value, `{${field.key}}`)
		}
	})
	
	return html
}

function extractStyles(doc: Document) {
	const styles: string[] = []
	
	// Get inline styles
	doc.querySelectorAll('style').forEach(style => {
		styles.push(style.textContent || '')
	})
	
	// Get linked stylesheets (would need proxy fetch)
	doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
		const href = link.getAttribute('href')
		if (href) {
			styles.push(`/* External: ${href} */`)
		}
	})
	
	return styles.join('\n')
}

function extractAssets(doc: Document, baseUrl: string) {
	const assets = {
		images: [] as string[],
		scripts: [] as string[],
		stylesheets: [] as string[]
	}
	
	// Images
	doc.querySelectorAll('img').forEach(img => {
		const src = img.getAttribute('src')
		if (src) {
			assets.images.push(new URL(src, baseUrl).href)
		}
	})
	
	// Scripts
	doc.querySelectorAll('script[src]').forEach(script => {
		const src = script.getAttribute('src')
		if (src) {
			assets.scripts.push(new URL(src, baseUrl).href)
		}
	})
	
	// Stylesheets
	doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
		const href = link.getAttribute('href')
		if (href) {
			assets.stylesheets.push(new URL(href, baseUrl).href)
		}
	})
	
	return assets
}

function extractMetaTags(doc: Document) {
	const meta: Record<string, string> = {}
	
	doc.querySelectorAll('meta').forEach(tag => {
		const name = tag.getAttribute('name') || tag.getAttribute('property')
		const content = tag.getAttribute('content')
		if (name && content) {
			meta[name] = content
		}
	})
	
	return meta
}

function extractLinks(doc: Document, baseUrl: string) {
	const links: string[] = []
	
	doc.querySelectorAll('a[href]').forEach(anchor => {
		const href = anchor.getAttribute('href')
		if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
			try {
				const url = new URL(href, baseUrl)
				links.push(url.href)
			} catch {
				// Invalid URL
			}
		}
	})
	
	return links
}

function hashElement(element: HTMLElement): string {
	const structure = getElementSignature(element)
	return btoa(structure).substring(0, 10)
}

function generateComponentName(element: HTMLElement): string {
	const tag = element.tagName.toLowerCase()
	const id = element.id
	const className = element.className.split(' ')[0]
	
	if (id) {
		return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')
	} else if (className) {
		return className.charAt(0).toUpperCase() + className.slice(1).replace(/-/g, ' ')
	} else {
		return tag.charAt(0).toUpperCase() + tag.slice(1) + ' Component'
	}
}

function generateId(): string {
	return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

async function processComponent(section: HTMLElement, index: number, total: number) {
	// Simulate heavy processing
	await new Promise(resolve => setTimeout(resolve, 10))
	
	return createComponent(section)
}

// Export for TypeScript
export {}