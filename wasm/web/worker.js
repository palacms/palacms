importScripts('/fs.js')
importScripts('/wasm_exec.js')
const go = new Go()
WebAssembly.instantiateStreaming(fetch('/palacms.wasm'), go.importObject)
	.then(async (result) => {
		self.postMessage('ready')
		await go.run(result.instance)
	})
	.catch((error) => {
		console.error(error)
	})

self.addEventListener('message', (event) => {
	if (event.data !== 'init') {
		return
	}

	const [port] = event.ports
	port.addEventListener('message', (event) => {
		if (!PB_REQUEST) {
			return
		}

		const request = event.data
		PB_REQUEST(request, (response) => {
			response.id = request.id
			port.postMessage(response)
		})
	})
	port.start()
})
