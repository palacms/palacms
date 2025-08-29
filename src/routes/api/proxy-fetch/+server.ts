import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url, binary = false } = await request.json()
		
		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 })
		}
		
		// Validate URL
		try {
			new URL(url)
		} catch {
			return json({ error: 'Invalid URL' }, { status: 400 })
		}
		
		// Fetch the resource
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; PalaCMS/1.0; +https://palacms.com)'
			}
		})
		
		if (!response.ok) {
			return json({ error: `Failed to fetch: ${response.statusText}` }, { status: response.status })
		}
		
		// Return appropriate response based on content type
		if (binary) {
			const buffer = await response.arrayBuffer()
			return new Response(buffer, {
				headers: {
					'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'
				}
			})
		} else {
			const text = await response.text()
			return new Response(text, {
				headers: {
					'Content-Type': response.headers.get('Content-Type') || 'text/plain'
				}
			})
		}
	} catch (error) {
		console.error('Proxy fetch error:', error)
		return json({ error: 'Failed to fetch resource' }, { status: 500 })
	}
}