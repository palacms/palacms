if (location.pathname !== '/') {
	location.pathname = '/'
} else {
	const worker = new Worker('/worker.js')
	const ready = new Promise((resolve) => {
		worker.addEventListener('message', (event) => {
			if (event.data.type === 'ready') {
				resolve()
			}
		})
	})

	const output = document.querySelector('#output')
	worker.addEventListener('message', (event) => {
		const { type, value } = event.data
		if (type === 'output') {
			const line = document.createElement('span')
			line.textContent = value + '\n'
			output.appendChild(line)
		}
	})

	const init = (sw) => {
		const channel = new MessageChannel()
		worker.postMessage({ type: 'init' }, [channel.port2])
		ready.then(() => {
			sw.postMessage({ type: 'init' }, [channel.port1])
			window.addEventListener('beforeunload', () => {
				sw.postMessage({ type: 'close' })
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
}
