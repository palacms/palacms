import registerPromiseWorker from 'promise-worker/register'
import postcss from 'postcss'
import nested from 'postcss-nested'

registerPromiseWorker(async function ({ css }) {
	try {
		const res = await postcss([nested]).process(css, { from: undefined })
		return { css: res.css }
	} catch (error) {
		return {
			error: formatCssError(error)
		}
	}
})

function formatCssError(error) {
	if (!error) return 'Unknown CSS error'

	if (typeof error === 'string') return error

	const name = error.name || 'CssError'
	const reason = error.reason || error.message || String(error)

	const line = error.line || error?.input?.line
	const column = error.column || error?.input?.column
	const location = line || column ? ` (line ${line ?? '?'}${column ? `, column ${column}` : ''})` : ''

	let message = `${name}: ${reason}${location}`

	if (typeof error.showSourceCode === 'function') {
		const frame = error.showSourceCode()
		if (frame) {
			message += `\n\n${frame}`
		}
	} else if (error.source) {
		message += `\n\n${error.source}`
	}

	return message
}
