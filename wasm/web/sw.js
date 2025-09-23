skipWaiting()

const resolvers = new Map()
let nextId = 1
let port

self.addEventListener('message', (event) => {
	if (event.data.type === 'init') {
		;[port] = event.ports
		port.addEventListener('message', (event) => {
			const { type, id, response } = event.data
			if (type === 'response') {
				let { body } = response
				if (body.length === 0) body = null
				const resolve = resolvers.get(id)
				resolve(new Response(body, response))
				resolvers.delete(id)
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

				resolvers.set(id, resolve)
				port.postMessage({ type: 'request', id, request })
			})
		})
	)
})
