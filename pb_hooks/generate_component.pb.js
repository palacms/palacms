/// <reference path="../pb_data/types.d.ts" />

/*
TODO: Future AI Component Generation Features
===========================================

1. IMAGE INPUT
   - Allow users to paste/upload screenshots or designs
   - Use Claude's vision capabilities to analyze the image
   - Generate component code that matches the visual design
   - Implementation: Add image upload to modal, pass base64 to Claude Vision API

2. SITE CSS VARIABLES
   - Pass site's CSS custom properties to AI context
   - AI uses existing design tokens instead of creating new values
   - Maintains design system consistency
   - Implementation: Extract CSS vars from site settings, include in prompt

3. TOKEN USAGE TRACKING
   - Show users how many tokens each modification costs
   - Display running total for the session
   - Help users understand API usage and costs
   - Implementation: Parse Claude API response usage data, display in UI
*/

routerAdd('POST', '/api/generate-component', (e) => {
	let requestData
	try {
		// Try to parse the request body as JSON
		const body = e.request.body
		requestData = JSON.parse(toString(body))
	} catch (err) {
		return e.json(400, { error: 'Invalid JSON in request body' })
	}

	const { prompt, api_key, existing_code, fields } = requestData

	if (!prompt || !prompt.trim()) {
		return e.json(400, { error: 'Prompt is required' })
	}

	// Use provided API key or fall back to environment variable
	const claude_api_key = api_key || $os.getenv('CLAUDE_API_KEY')

	if (!claude_api_key) {
		return e.json(500, { error: 'API key not configured' })
	}

	try {
		const response = $http.send({
			url: 'https://api.anthropic.com/v1/messages',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': claude_api_key,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-3-5-sonnet-20241022',
				max_tokens: 4000,
				messages: [
					{
						role: 'user',
						content: `${
							existing_code && (existing_code.html || existing_code.css || existing_code.js)
								? `Modify this existing Svelte component based on: ${prompt}

CURRENT COMPONENT:
HTML:
${existing_code.html || '<!-- No HTML yet -->'}

CSS:
${existing_code.css || '/* No CSS yet */'}

JS:
${existing_code.js || '// No JS yet'}

MODIFICATION REQUEST: ${prompt}`
								: `Create a Svelte component based on this description: ${prompt}`
						}

${
	fields && fields.length > 0
		? `
AVAILABLE FIELDS (use these for dynamic content):
${fields.map((field) => `- {${field.key}} (${field.label}) - Type: ${typeof field.type === 'object' ? JSON.stringify(field.type) : field.type}`).join('\n')}

IMPORTANT: Use {field_key} syntax in your HTML to reference these fields. For example: {heading}, {image.url}, {image.alt}`
		: ''
}

Provide the component code in three sections:
1. HTML/Template (Svelte markup)
2. CSS (styles)  
3. JavaScript (any script logic)

IMPORTANT:
- ${fields && fields.length > 0 ? 'Use the available fields above for dynamic content instead of hardcoded values. These variables are already globally available - do NOT add export let statements or const declarations for them.' : "Use hardcoded content/data, don't use props or external data"}
- Use Svelte 5 syntax (runes like $state, $derived, etc.)
- Make it a complete, working component
- Keep styles minimal and clean - only essential styling
- Keep styles scoped to the component
- Return ONLY the code, no explanations
- For JavaScript: provide ONLY the script content, NO <script> tags
- Format your response as:
HTML:
[html code here]

CSS:
[css code here]

JS:
[js code here]`
					}
				]
			}),
			timeout: 30 // 30 second timeout
		})

		if (response.statusCode !== 200) {
			let error = 'API request failed'
			try {
				const errorData = JSON.parse(response.raw)
				error = errorData.error?.message || error
			} catch (e) {
				// couldn't parse error
			}
			return e.json(response.statusCode || 500, { error: error })
		}

		const data = JSON.parse(response.raw)
		const content = data.content[0].text

		// Parse the response to extract HTML, CSS, and JS
		const html_match = content.match(/HTML:\s*([\s\S]*?)(?:\n\nCSS:|$)/)
		const css_match = content.match(/CSS:\s*([\s\S]*?)(?:\n\nJS:|$)/)
		const js_match = content.match(/JS:\s*([\s\S]*?)$/)

		const result = {
			html: html_match ? html_match[1].trim() : '',
			css: css_match ? css_match[1].trim() : '',
			js: js_match ? js_match[1].trim() : ''
		}

		return e.json(200, result)
	} catch (error) {
		console.log('Error generating component:', error)
		return e.json(500, { error: error.toString() })
	}
})
