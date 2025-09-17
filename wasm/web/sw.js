skipWaiting()

let nextId = 1
let port

self.addEventListener('message', (event) => {
	if (event.data === 'init') {
		;[port] = event.ports
	} else if (event.data === 'exit') {
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
			const request = {
				id: nextId++,
				method: event.request.method,
				url: event.request.url,
				headers: Array.from(event.request.headers),
				body: new Uint8Array(buffer)
			}
			port.postMessage(request)

			return new Promise((resolve) => {
				port.addEventListener('message', (event) => {
					const response = event.data
					if (response.id === request.id) {
						resolve(new Response(response.body, response))
					}
				})
				port.start()
			})
		})
	)
})
