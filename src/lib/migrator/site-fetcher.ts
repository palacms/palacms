/**
 * Site Fetcher - Fetches and parses live websites for migration to Pala
 */

export interface FetchedPage {
	url: string
	path: string
	title: string
	html: string
	styles: string[]
	scripts: string[]
	images: string[]
	meta: Record<string, string>
}

export interface FetchedSite {
	url: string
	domain: string
	pages: FetchedPage[]
	assets: {
		styles: Map<string, string>
		scripts: Map<string, string>
		images: Map<string, ArrayBuffer>
		fonts: Map<string, ArrayBuffer>
	}
	globalStyles: string
	globalScripts: string
}

export class SiteFetcher {
	private baseUrl: string
	private visitedUrls: Set<string> = new Set()
	private maxDepth: number = 3
	private maxPages: number = 50
	
	constructor(url: string, options?: { maxDepth?: number; maxPages?: number }) {
		this.baseUrl = this.normalizeUrl(url)
		this.maxDepth = options?.maxDepth ?? 3
		this.maxPages = options?.maxPages ?? 50
	}
	
	private normalizeUrl(url: string): string {
		try {
			const parsed = new URL(url)
			return parsed.origin
		} catch {
			// If URL parsing fails, try adding protocol
			return this.normalizeUrl(`https://${url}`)
		}
	}
	
	async fetch(onProgress?: (message: string, progress: number) => void): Promise<FetchedSite> {
		const site: FetchedSite = {
			url: this.baseUrl,
			domain: new URL(this.baseUrl).hostname,
			pages: [],
			assets: {
				styles: new Map(),
				scripts: new Map(),
				images: new Map(),
				fonts: new Map()
			},
			globalStyles: '',
			globalScripts: ''
		}
		
		// Start with the homepage
		onProgress?.('Fetching homepage...', 0)
		await this.fetchPage(this.baseUrl, site, 0, onProgress)
		
		// Extract global styles and scripts
		this.extractGlobalAssets(site)
		
		onProgress?.('Migration complete!', 100)
		return site
	}
	
	private async fetchPage(
		url: string, 
		site: FetchedSite, 
		depth: number,
		onProgress?: (message: string, progress: number) => void
	): Promise<void> {
		// Check limits
		if (depth > this.maxDepth || site.pages.length >= this.maxPages) {
			return
		}
		
		// Normalize and check if already visited
		const normalizedUrl = this.normalizePageUrl(url)
		if (this.visitedUrls.has(normalizedUrl)) {
			return
		}
		this.visitedUrls.add(normalizedUrl)
		
		try {
			const progress = (site.pages.length / this.maxPages) * 100
			onProgress?.(`Fetching ${url}...`, progress)
			
			const response = await fetch('/api/proxy-fetch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: normalizedUrl })
			})
			
			if (!response.ok) {
				console.error(`Failed to fetch ${url}: ${response.statusText}`)
				return
			}
			
			const html = await response.text()
			const page = await this.parsePage(normalizedUrl, html, site)
			site.pages.push(page)
			
			// Find and fetch linked pages
			const links = this.extractInternalLinks(html, normalizedUrl)
			for (const link of links) {
				await this.fetchPage(link, site, depth + 1, onProgress)
			}
		} catch (error) {
			console.error(`Error fetching ${url}:`, error)
		}
	}
	
	private normalizePageUrl(url: string): string {
		try {
			const parsed = new URL(url, this.baseUrl)
			// Remove hash and normalize
			parsed.hash = ''
			return parsed.href
		} catch {
			return url
		}
	}
	
	private async parsePage(url: string, html: string, site: FetchedSite): Promise<FetchedPage> {
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, 'text/html')
		
		// Extract path from URL
		const urlObj = new URL(url)
		const path = urlObj.pathname === '/' ? '/index' : urlObj.pathname
		
		// Extract title
		const title = doc.querySelector('title')?.textContent || 'Untitled Page'
		
		// Extract meta tags
		const meta: Record<string, string> = {}
		doc.querySelectorAll('meta').forEach(tag => {
			const name = tag.getAttribute('name') || tag.getAttribute('property')
			const content = tag.getAttribute('content')
			if (name && content) {
				meta[name] = content
			}
		})
		
		// Extract and download styles
		const styles: string[] = []
		for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
			const href = link.getAttribute('href')
			if (href) {
				const styleUrl = new URL(href, url).href
				styles.push(styleUrl)
				await this.fetchAsset(styleUrl, 'styles', site)
			}
		}
		
		// Extract inline styles
		doc.querySelectorAll('style').forEach(style => {
			styles.push(`inline:${style.textContent}`)
		})
		
		// Extract and download scripts
		const scripts: string[] = []
		for (const script of doc.querySelectorAll('script[src]')) {
			const src = script.getAttribute('src')
			if (src) {
				const scriptUrl = new URL(src, url).href
				scripts.push(scriptUrl)
				await this.fetchAsset(scriptUrl, 'scripts', site)
			}
		}
		
		// Extract and download images
		const images: string[] = []
		for (const img of doc.querySelectorAll('img')) {
			const src = img.getAttribute('src')
			if (src) {
				const imgUrl = new URL(src, url).href
				images.push(imgUrl)
				await this.fetchAsset(imgUrl, 'images', site)
			}
		}
		
		return {
			url,
			path,
			title,
			html,
			styles,
			scripts,
			images,
			meta
		}
	}
	
	private extractInternalLinks(html: string, baseUrl: string): string[] {
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, 'text/html')
		const links: string[] = []
		
		doc.querySelectorAll('a[href]').forEach(anchor => {
			const href = anchor.getAttribute('href')
			if (!href) return
			
			try {
				const linkUrl = new URL(href, baseUrl)
				// Only follow internal links
				if (linkUrl.origin === this.baseUrl) {
					links.push(linkUrl.href)
				}
			} catch {
				// Invalid URL, skip
			}
		})
		
		return links
	}
	
	private async fetchAsset(
		url: string, 
		type: 'styles' | 'scripts' | 'images' | 'fonts',
		site: FetchedSite
	): Promise<void> {
		// Skip if already fetched
		if (site.assets[type].has(url)) {
			return
		}
		
		try {
			const response = await fetch('/api/proxy-fetch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, binary: type === 'images' || type === 'fonts' })
			})
			
			if (!response.ok) {
				console.error(`Failed to fetch asset ${url}`)
				return
			}
			
			if (type === 'styles' || type === 'scripts') {
				const text = await response.text()
				site.assets[type].set(url, text)
				
				// Check for font references in CSS
				if (type === 'styles') {
					await this.extractFontsFromCSS(text, url, site)
				}
			} else {
				const buffer = await response.arrayBuffer()
				site.assets[type].set(url, buffer)
			}
		} catch (error) {
			console.error(`Error fetching asset ${url}:`, error)
		}
	}
	
	private async extractFontsFromCSS(css: string, baseUrl: string, site: FetchedSite): Promise<void> {
		const fontRegex = /url\(['"]?([^'")]+)['"]?\)/g
		let match
		
		while ((match = fontRegex.exec(css)) !== null) {
			const fontUrl = match[1]
			if (fontUrl.match(/\.(woff2?|ttf|otf|eot)$/i)) {
				try {
					const absoluteUrl = new URL(fontUrl, baseUrl).href
					await this.fetchAsset(absoluteUrl, 'fonts', site)
				} catch {
					// Invalid URL, skip
				}
			}
		}
	}
	
	private extractGlobalAssets(site: FetchedSite): void {
		// Combine all external styles
		const globalStyles: string[] = []
		site.assets.styles.forEach((content, url) => {
			globalStyles.push(`/* Source: ${url} */\n${content}`)
		})
		site.globalStyles = globalStyles.join('\n\n')
		
		// Combine all external scripts
		const globalScripts: string[] = []
		site.assets.scripts.forEach((content, url) => {
			globalScripts.push(`/* Source: ${url} */\n${content}`)
		})
		site.globalScripts = globalScripts.join('\n\n')
	}
}