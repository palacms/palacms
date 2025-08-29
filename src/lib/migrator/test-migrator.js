/**
 * Test script for the site migrator
 * Run with: node src/lib/migrator/test-migrator.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mock DOM parser for Node.js
global.DOMParser = class {
	parseFromString(html, type) {
		// Simple HTML parser mock
		const doc = {
			body: null,
			querySelector: (selector) => {
				if (selector === 'title') {
					const titleMatch = html.match(/<title>(.*?)<\/title>/i)
					return titleMatch ? { textContent: titleMatch[1] } : null
				}
				return null
			},
			querySelectorAll: (selector) => {
				const results = []
				
				if (selector === 'meta') {
					const metaRegex = /<meta\s+([^>]+)>/gi
					let match
					while ((match = metaRegex.exec(html)) !== null) {
						const attrs = match[1]
						const nameMatch = attrs.match(/name="([^"]+)"/)
						const contentMatch = attrs.match(/content="([^"]+)"/)
						if (nameMatch && contentMatch) {
							results.push({
								getAttribute: (attr) => {
									if (attr === 'name') return nameMatch[1]
									if (attr === 'content') return contentMatch[1]
									return null
								}
							})
						}
					}
				} else if (selector === 'header, nav, main, section, article, aside, footer') {
					// Find semantic sections
					const sectionRegex = /<(header|nav|main|section|article|aside|footer)[^>]*>([\s\S]*?)<\/\1>/gi
					let match
					while ((match = sectionRegex.exec(html)) !== null) {
						results.push({
							tagName: match[1].toUpperCase(),
							innerHTML: match[2],
							outerHTML: match[0],
							className: '',
							id: '',
							textContent: match[2].replace(/<[^>]+>/g, '').trim(),
							cloneNode: function(deep) { return this },
							querySelectorAll: () => [],
							children: []
						})
					}
				} else if (selector === 'h1, h2, h3, h4, h5, h6, p, span, a') {
					// Find text elements
					const textRegex = /<(h[1-6]|p|span|a)[^>]*>(.*?)<\/\1>/gi
					let match
					while ((match = textRegex.exec(html)) !== null) {
						results.push({
							tagName: match[1].toUpperCase(),
							textContent: match[2].replace(/<[^>]+>/g, '').trim()
						})
					}
				} else if (selector === 'img') {
					const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi
					let match
					while ((match = imgRegex.exec(html)) !== null) {
						results.push({
							tagName: 'IMG',
							getAttribute: (attr) => attr === 'src' ? match[1] : null
						})
					}
				}
				
				return results
			}
		}
		
		// Parse body
		const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
		if (bodyMatch) {
			doc.body = {
				innerHTML: bodyMatch[1],
				outerHTML: bodyMatch[0],
				children: [],
				querySelectorAll: doc.querySelectorAll
			}
		}
		
		return doc
	}
}

// Mock URL class for Node.js environment
global.URL = URL

// Mock fetch for Node.js
global.fetch = async (url, options) => {
	if (url === '/api/proxy-fetch') {
		const body = JSON.parse(options.body)
		const testUrl = body.url
		
		// For testing, read local file
		if (testUrl.includes('localhost') || testUrl.includes('file://')) {
			const filePath = path.join(__dirname, '../../../test-site/index.html')
			const html = fs.readFileSync(filePath, 'utf-8')
			return {
				ok: true,
				text: async () => html,
				arrayBuffer: async () => Buffer.from(html)
			}
		}
	}
	
	return {
		ok: false,
		statusText: 'Not found'
	}
}

// Test the HTML to Pala converter
async function testConverter() {
	console.log('Testing HTML to Pala Converter...\n')
	
	// Read test HTML
	const htmlPath = path.join(__dirname, '../../../test-site/index.html')
	const html = fs.readFileSync(htmlPath, 'utf-8')
	
	// Create mock fetched site
	const fetchedSite = {
		url: 'http://localhost:3000',
		domain: 'localhost',
		pages: [{
			url: 'http://localhost:3000/',
			path: '/',
			title: 'Test Company - Home',
			html: html,
			styles: ['inline:' + extractStyles(html)],
			scripts: [],
			images: [],
			meta: {
				description: 'Welcome to Test Company - Your trusted partner'
			}
		}],
		assets: {
			styles: new Map(),
			scripts: new Map(),
			images: new Map(),
			fonts: new Map()
		},
		globalStyles: '',
		globalScripts: ''
	}
	
	// Import and test converter
	const { HtmlToPalaConverter } = await import('./html-to-pala.js')
	const converter = new HtmlToPalaConverter(fetchedSite)
	const palaSite = converter.convert()
	
	console.log('Converted Site:')
	console.log('===============')
	console.log(`Name: ${palaSite.name}`)
	console.log(`Pages: ${palaSite.pages.length}`)
	console.log(`Components: ${palaSite.symbols.length}`)
	
	console.log('\nPages:')
	palaSite.pages.forEach(page => {
		console.log(`  - ${page.name} (${page.slug || '/'})`)
		console.log(`    Sections: ${page.sections.length}`)
	})
	
	console.log('\nComponents:')
	palaSite.symbols.forEach(symbol => {
		console.log(`  - ${symbol.name}`)
		console.log(`    Fields: ${symbol.fields.length}`)
		if (symbol.fields.length > 0) {
			symbol.fields.slice(0, 3).forEach(field => {
				console.log(`      • ${field.label}`)
			})
			if (symbol.fields.length > 3) {
				console.log(`      ... and ${symbol.fields.length - 3} more`)
			}
		}
	})
	
	// Save output for inspection
	const outputPath = path.join(__dirname, '../../../test-site/converted-site.json')
	fs.writeFileSync(outputPath, JSON.stringify(palaSite, null, 2))
	console.log(`\n✅ Conversion complete! Output saved to: ${outputPath}`)
}

function extractStyles(html) {
	const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
	const styles = []
	let match
	while ((match = styleRegex.exec(html)) !== null) {
		styles.push(match[1])
	}
	return styles.join('\n')
}

// Run the test
testConverter().catch(console.error)