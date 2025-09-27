const resolvers = new Map()
let nextId = 1
let serverId
let port

self.addEventListener('install', () => {
	self.skipWaiting()
})

self.addEventListener('message', (event) => {
	if (event.data.type === 'init') {
		serverId = event.source.id
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
		serverId = undefined
		port = undefined
	}
})

self.addEventListener('fetch', (event) => {
	if (!serverId || !port) {
		return
	}

	const url = new URL(event.request.url)
	if (url.origin !== location.origin) {
		return
	}

	event.respondWith(
		Promise.resolve().then(async () => {
			const server = await self.clients.get(serverId)
			if (!server) {
				port.close()
				serverId = undefined
				port = undefined

				if (event.clientId) {
					return new Response(null, { status: 503 })
				} else {
					return fetch(event.request)
				}
			}

			const id = nextId++
			const request = {
				method: event.request.method,
				url: event.request.url,
				headers: Array.from(event.request.headers),
				body: new Uint8Array(await event.request.arrayBuffer())
			}
			return new Promise((resolve) => {
				resolvers.set(id, resolve)
				port.postMessage({ type: 'request', id, request })
			})
		})
	)
})
