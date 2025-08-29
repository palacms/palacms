/**
 * Hook to use the migrator web worker
 */

export class MigratorWorker {
	private worker: Worker | null = null
	private onProgress?: (message: string, progress: number) => void
	private onComplete?: (result: any) => void
	private onError?: (error: string) => void
	
	constructor() {
		if (typeof Worker !== 'undefined') {
			// Create worker instance
			this.worker = new Worker(
				new URL('./migrator.worker.ts', import.meta.url),
				{ type: 'module' }
			)
			
			// Set up message handler
			this.worker.addEventListener('message', (event) => {
				const { type, data } = event.data
				
				switch (type) {
					case 'PROGRESS':
						this.onProgress?.(data.message, data.progress)
						break
					case 'RESULT':
						this.onComplete?.(data)
						break
					case 'ERROR':
						this.onError?.(data.message)
						break
				}
			})
		}
	}
	
	async migrate(
		url: string,
		options: { maxPages?: number; maxDepth?: number } = {},
		callbacks: {
			onProgress?: (message: string, progress: number) => void
			onComplete?: (result: any) => void
			onError?: (error: string) => void
		} = {}
	) {
		if (!this.worker) {
			throw new Error('Web Workers not supported')
		}
		
		// Set callbacks
		this.onProgress = callbacks.onProgress
		this.onComplete = callbacks.onComplete
		this.onError = callbacks.onError
		
		// Start migration in worker
		this.worker.postMessage({
			type: 'START_MIGRATION',
			data: { url, options }
		})
	}
	
	processPage(html: string, url: string): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('Web Workers not supported'))
				return
			}
			
			const handler = (event: MessageEvent) => {
				const { type, data } = event.data
				if (type === 'RESULT') {
					this.worker!.removeEventListener('message', handler)
					resolve(data)
				} else if (type === 'ERROR') {
					this.worker!.removeEventListener('message', handler)
					reject(new Error(data.message))
				}
			}
			
			this.worker.addEventListener('message', handler)
			
			this.worker.postMessage({
				type: 'PROCESS_PAGE',
				data: { html, url }
			})
		})
	}
	
	extractComponents(html: string): Promise<any[]> {
		return new Promise((resolve, reject) => {
			if (!this.worker) {
				reject(new Error('Web Workers not supported'))
				return
			}
			
			const handler = (event: MessageEvent) => {
				const { type, data } = event.data
				if (type === 'RESULT') {
					this.worker!.removeEventListener('message', handler)
					resolve(data)
				} else if (type === 'ERROR') {
					this.worker!.removeEventListener('message', handler)
					reject(new Error(data.message))
				}
			}
			
			this.worker.addEventListener('message', handler)
			
			this.worker.postMessage({
				type: 'EXTRACT_COMPONENTS',
				data: { html }
			})
		})
	}
	
	terminate() {
		this.worker?.terminate()
		this.worker = null
	}
}

// Singleton instance
let migratorWorker: MigratorWorker | null = null

export function useMigratorWorker() {
	if (!migratorWorker) {
		migratorWorker = new MigratorWorker()
	}
	return migratorWorker
}