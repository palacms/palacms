const startServer = async () =>
	new Promise((resolve) => {
		const worker = new Worker('/worker.js')
		const output = document.querySelector('#output')

		const init = (sw) => {
			const channel = new MessageChannel()
			worker.postMessage({ type: 'init' }, [channel.port2])
			sw.postMessage({ type: 'init' }, [channel.port1])
			window.addEventListener('beforeunload', () => {
				sw.postMessage({ type: 'close' })
				worker.terminate()
			})
		}

		worker.addEventListener('message', (event) => {
			const { type, value } = event.data
			if (type === 'ready') {
				navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
					if (registration.active) {
						init(registration.active)
					}
					registration.addEventListener('updatefound', () => init(registration.installing))
					resolve()
				})
			} else if (type === 'output') {
				const isScrolledDown = output.scrollTop + output.clientHeight === output.scrollHeight
				const line = document.createElement('span')
				line.textContent = value + '\n'
				output.appendChild(line)
				if (isScrolledDown) {
					output.scrollTop = output.scrollHeight - output.clientHeight
				}
			}
		})
	})

if (window.name === 'server') {
	startServer()
	document.querySelector('#info').open = false
	document.querySelector('#open').hidden = false
} else {
	document.querySelector('#start').hidden = false
}

document.querySelector('#start').addEventListener('click', () => {
	window.name = 'server'
	startServer().then(() => {
		window.open(location.href, '_blank')
		history.replaceState(null, '', '/')
	})
	document.querySelector('#info').open = false
	document.querySelector('#open').hidden = false
	document.querySelector('#start').hidden = true
})
