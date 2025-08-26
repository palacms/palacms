import { untrack } from 'svelte'

export type DoneCallback = (error?: unknown) => void

export const useSvelteWorker = (ready: () => boolean, loaded: () => boolean, work: () => void | Promise<void>) => {
	let status = $state<'waiting' | 'standby' | 'loading' | 'working'>('standby')
	let done = $state<DoneCallback>()

	$effect(() => {
		if (status === 'waiting' && ready()) {
			status = 'standby'
		} else if (status === 'standby' && !ready()) {
			status = 'waiting'
		}

		if (status === 'loading' && loaded()) {
			status = 'working'
			untrack(() =>
				Promise.resolve()
					.then(() => work())
					.then(() => done?.())
					.catch((error) => done?.(error))
			)
		}
	})

	return new (class {
		status = $derived(status)

		async run() {
			if (status === 'standby') {
				status = 'loading'
			} else {
				throw new Error('Cannot run, worker not in standby')
			}

			return new Promise<void>((resolve, reject) => {
				done = (error) => {
					status = 'standby'
					if (error) {
						reject(error)
					} else {
						resolve()
					}
				}
			})
		}
	})()
}
