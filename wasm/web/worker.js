importScripts('/fs.js')
importScripts('/wasm_exec.js')

const go = new Go()
go.env.PALA_APP_URL = location.origin
go.env.PALA_SUPERUSER_EMAIL = 'demo@palacms.com'
go.env.PALA_SUPERUSER_PASSWORD = 'demo1234'
go.env.PALA_USER_EMAIL = 'demo@palacms.com'
go.env.PALA_USER_PASSWORD = 'demo1234'
go.env.PALA_DISABLE_USAGE_STATS = 'true'

WebAssembly.instantiateStreaming(fetch('/palacms.wasm'), go.importObject)
	.then((result) => go.run(result.instance))
	.catch((error) => console.error(error))

self.output = (value) => {
	self.postMessage({ type: 'output', value })
}

const queue = []
let handle = (request, callback) => {
	queue.push({ request, callback })
}
self.ON_PALA_READY = (h) => {
	handle = h
	for (const { request, callback } of queue) {
		handle(request, callback)
	}
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
		handle(request, (response) => {
			port.postMessage({ type: 'response', id, response })
		})
	})
	port.start()
})

self.postMessage({ type: 'ready' })
