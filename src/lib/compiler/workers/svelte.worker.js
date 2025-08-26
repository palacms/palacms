import registerPromiseWorker from 'promise-worker/register'
import { compile as svelte_compile } from 'svelte/compiler'

registerPromiseWorker(async function ({ code, svelteOptions }) {
	const res = svelte_compile(code, svelteOptions)
	return {
		code: res?.js?.code,
		warnings: res.warnings.map((w) => ({ message: w.message, code: w.code }))
	}
})
