const worker = new Worker('/worker.js')
const init = (sw) => {
	const channel = new MessageChannel()
	sw.postMessage('init', [channel.port1])
	worker.postMessage('init', [channel.port2])
}

navigator.serviceWorker
	.register('/sw.js', {
		scope: '/'
	})
	.then((registration) => {
		if (registration.active) {
			init(registration.active)
		}
		registration.addEventListener('updatefound', () => init(registration.installing))
	})
