importScripts('/fs.js')
importScripts('/wasm_exec.js')
const go = new Go()
WebAssembly.instantiateStreaming(fetch('/palacms.wasm'), go.importObject)
	.then(async (result) => {
		self.postMessage({ type: 'ready' })
		await go.run(result.instance)
	})
	.catch((error) => {
		console.error(error)
	})

self.output = (value) => {
	self.postMessage({ type: 'output', value })
}

self.addEventListener('message', (event) => {
	if (event.data.type !== 'init') {
		return
	}

	const [port] = event.ports
	port.addEventListener('message', (event) => {
		if (event.data.type !== 'request') {
			return
		}

		const { id, request } = event.data
		if ('PB_REQUEST' in self) {
			PB_REQUEST(request, (response) => {
				port.postMessage({ type: 'response', id, response })
			})
		} else {
			port.postMessage({ type: 'response', id, response: { status: 502 } })
		}
	})
	port.start()
})
