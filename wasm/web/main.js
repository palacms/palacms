const worker = new Worker('/worker.js')
const init = (sw) => {
	const channel = new MessageChannel()
	worker.postMessage('init', [channel.port2])
	worker.addEventListener('message', (event) => {
		if (event.data !== 'ready') {
			return
		}

		sw.postMessage('init', [channel.port1])
		window.addEventListener('beforeunload', () => {
			sw.postMessage('exit')
			worker.terminate()
		})
	})
}

navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
	if (registration.active) {
		init(registration.active)
	}
	registration.addEventListener('updatefound', () => init(registration.installing))
})
