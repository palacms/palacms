import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
// Note: These imports would only work server-side
// import { chromium } from 'playwright' 
// import PurgeCSS from 'purgecss'

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url, options } = await request.json()
		
		// For now, we'll use the simple fetch approach
		// In production, you'd use Playwright here
		const response = await fetch(url)
		const html = await response.text()
		
		// Parse HTML server-side
		// Note: We'd need a server-side DOM parser like jsdom or cheerio
		const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }))
		
		if (!JSDOM) {
			// Fallback to simple regex parsing
			return json({
				success: true,
				site: {
					url,
					pages: [{
						url,
						path: '/',
						title: html.match(/<title>(.*?)<\/title>/)?.[1] || 'Untitled',
						html,
						sections: []
					}],
					components: []
				}
			})
		}
		
		const dom = new JSDOM(html)
		const document = dom.window.document
		
		// Extract components server-side
		const components = []
		const sections = document.querySelectorAll('header, nav, section, article, footer')
		
		sections.forEach(section => {
			components.push({
				id: crypto.randomUUID(),
				name: section.tagName.toLowerCase(),
				html: section.outerHTML,
				fields: extractFields(section)
			})
		})
		
		return json({
			success: true,
			site: {
				url,
				pages: [{
					url,
					path: '/',
					title: document.title,
					html,
					sections: components.map(c => c.id)
				}],
				components
			}
		})
		
	} catch (error) {
		console.error('Migration error:', error)
		return json(
			{ error: 'Failed to migrate site' },
			{ status: 500 }
		)
	}
}

function extractFields(element: Element) {
	const fields = []
	
	// Extract text content
	const textElements = element.querySelectorAll('h1, h2, h3, h4, h5, h6, p')
	textElements.forEach((el, index) => {
		const text = el.textContent?.trim()
		if (text) {
			fields.push({
				key: `text_${index}`,
				type: 'text',
				value: text
			})
		}
	})
	
	// Extract images
	const images = element.querySelectorAll('img')
	images.forEach((img, index) => {
		fields.push({
			key: `image_${index}`,
			type: 'image',
			value: img.getAttribute('src')
		})
	})
	
	return fields
}