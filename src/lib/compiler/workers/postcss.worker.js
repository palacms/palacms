import registerPromiseWorker from 'promise-worker/register'
import postcss from 'postcss'
import nested from 'postcss-nested'

registerPromiseWorker(async function ({ css }) {
	const res = await postcss([nested]).process(css)
	return res.css
})
