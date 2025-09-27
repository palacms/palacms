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

const init = () => {
	const channel = new MessageChannel()
	sw.postMessage({ type: 'init' }, [channel.port1])
	worker.postMessage({ type: 'init' }, [channel.port2])
}

let sw
let worker
let controller
const startServer = async () =>
	new Promise((resolve) => {
		print('Loading PalaCMS...')
		if (worker) worker.terminate()
		worker = new Worker('/worker.js')
		worker.addEventListener('message', (event) => {
			const { type, value } = event.data
			if (type === 'ready') {
				const channel = new MessageChannel()
				worker.postMessage({ type: 'init' }, [channel.port2])
				navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
					sw = registration.installing ?? registration.active
					init()
					registration.addEventListener('updatefound', () => {
						sw = registration.installing
						init()
					})

					controller = new AbortController()
					resolve(
						fetch('/api/palacms/info', { signal: controller.signal }).then((res) => {
							controller = undefined
							if (!res.ok) {
								throw new Error('Non-ok response')
							}
						})
					)
				})
			} else if (type === 'output') {
				print(value)
			}
		})
	})

const stopServer = () => {
	if (sw) sw.postMessage({ type: 'close' })
	if (worker) worker.terminate()
	if (controller) controller.abort()
	sw = undefined
	worker = undefined
	controller = undefined
}

const resetServer = async () => {
	stopServer()
	const root = await navigator.storage.getDirectory()
	await root.removeEntry('pb_data', { recursive: true })
}

if (window.name === 'server') {
	document.querySelector('#reset').hidden = false
	startServer().then(() => {
		document.querySelector('#open').hidden = false
	})
} else {
	document.querySelector('#start').hidden = false
	document.querySelector('#info').open = true
	navigator.storage.getDirectory().then(async (root) => {
		const keys = await Array.fromAsync(root.keys())
		if (keys.includes('pb_data')) {
			document.querySelector('#reset').hidden = false
		}
	})
}

document.querySelector('#start').addEventListener('click', () => {
	window.name = 'server'
	document.querySelector('#info').open = false
	document.querySelector('#start').hidden = true
	document.querySelector('#reset').hidden = false
	startServer()
		.then(() => {
			document.querySelector('#open').hidden = false
			history.replaceState(null, '', '/')
		})
		.catch((error) => {
			console.error(error)
			print(error)
			stopServer()
		})
})

document.querySelector('#reset').addEventListener('click', () => {
	resetServer().then(() => {
		window.name = ''
		output.innerHTML = ''
		document.querySelector('#open').hidden = true
		document.querySelector('#start').hidden = false
		document.querySelector('#reset').hidden = true
	})
})

window.addEventListener('beforeunload', () => {
	stopServer()
})
