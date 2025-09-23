skipWaiting()

const listeners = new Map()
let nextId = 1
let port

self.addEventListener('message', (event) => {
	if (event.data.type === 'init') {
		;[port] = event.ports
		port.addEventListener('message', (event) => {
			const { type, id, response } = event.data
			if (type === 'response') {
				const listener = listeners.get(id)
				listener(response)
				listeners.delete(id)
			}
		})
		port.start()
	} else if (event.data.type === 'close') {
		port.close()
		port = undefined
	}
})

self.addEventListener('fetch', (event) => {
	if (!port) {
		return
	}

	const url = new URL(event.request.url)
	if (url.origin !== location.origin) {
		return
	}

	event.respondWith(
		event.request.arrayBuffer().then((buffer) => {
			return new Promise((resolve) => {
				const id = nextId++
				const request = {
					method: event.request.method,
					url: event.request.url,
					headers: Array.from(event.request.headers),
					body: new Uint8Array(buffer)
				}

				listeners.set(id, (response) => resolve(new Response(response.body, response)))
				port.postMessage({ type: 'request', id, request })
			})
		})
	)
})
