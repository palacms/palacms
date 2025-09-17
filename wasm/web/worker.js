importScripts('/fs.js')
importScripts('/wasm_exec.js')
const go = new Go()
WebAssembly.instantiateStreaming(fetch('/palacms.wasm'), go.importObject)
	.then((result) => go.run(result.instance))
	.catch((error) => {
		console.error(error)
	})

self.addEventListener('message', (event) => {
	const [port] = event.ports
	port.addEventListener('message', (event) => {
		if (!PB_REQUEST) {
			return
		}

		const request = event.data
		const response = {
			id: request.id
		}
		PB_REQUEST(request, response)
		port.postMessage(response)
	})
	port.start()
})
