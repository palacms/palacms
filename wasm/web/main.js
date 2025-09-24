const output = document.querySelector('#output')
const print = (value) => {
	const isScrolledDown = output.scrollTop + output.clientHeight === output.scrollHeight
	const line = document.createElement('span')
	line.textContent = value + '\n'
	output.appendChild(line)
	if (isScrolledDown) {
		output.scrollTop = output.scrollHeight - output.clientHeight
	}
}

const startServer = async () =>
	new Promise((resolve) => {
		print('Loading PalaCMS...')
		const worker = new Worker('/worker.js')

		const init = (sw) => {
			const channel = new MessageChannel()
			worker.postMessage({ type: 'init' }, [channel.port2])
			sw.postMessage({ type: 'init' }, [channel.port1])
			window.addEventListener('beforeunload', () => {
				sw.postMessage({ type: 'close' })
				worker.terminate()
			})
			fetch('/api/palacms/info').then(() => resolve())
		}

		worker.addEventListener('message', (event) => {
			const { type, value } = event.data
			if (type === 'ready') {
				navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
					if (registration.active) {
						init(registration.active)
					}
					registration.addEventListener('updatefound', () => init(registration.installing))
				})
			} else if (type === 'output') {
				print(value)
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

let opened = false
document.querySelector('#open').addEventListener('click', () => {
	opened = true
})

document.querySelector('#start').addEventListener('click', () => {
	window.name = 'server'
	startServer().then(() => {
		if (!opened) {
			window.open(location.href, '_blank')
		}
		history.replaceState(null, '', '/')
	})
	document.querySelector('#info').open = false
	document.querySelector('#open').hidden = false
	document.querySelector('#start').hidden = true
})
