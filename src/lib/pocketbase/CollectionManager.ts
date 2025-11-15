import type { ObjectWithId } from './Object'
import type { BatchRequestResult, RecordModel } from 'pocketbase'
import { OrderedSvelteMap } from './OrderedSvelteMap'
import type Client from 'pocketbase'

export type Change<T extends ObjectWithId> =
	| { collection: string; operation: 'create'; committed: boolean; data: Omit<T, 'id'> }
	| { collection: string; operation: 'update'; committed: boolean; data: Partial<T> }
	| { collection: string; operation: 'delete'; committed: boolean }

export type TrackedRecord = {
	data: ObjectWithId
}

export type TrackedList = {
	invalidated: boolean
	ids: string[]
}

export type CollectionManager = ReturnType<typeof createCollectionManager>

export const createCollectionManager = (instance?: Client) => {
	const changes = new OrderedSvelteMap<string, Change<ObjectWithId>>()
	const records = new OrderedSvelteMap<string, TrackedRecord | undefined | null>()
	const lists = new OrderedSvelteMap<string, TrackedList | undefined | null>()

	let promise = Promise.resolve()

	return {
		instance,
		changes,
		records,
		lists,
		commit: async () => {
			if (!instance) {
				throw new Error('No instance')
			}

			promise = promise.finally(async () => {
				const batch = instance.createBatch()

				/**
				 * Record IDs added to this batch.
				 */
				const batched_changes: string[] = []

				/**
				 * One result handler per batched change in order of execution.
				 * Result handlers are called after the batch has been sent and result is received.
				 */
				const result_handlers: ((result: BatchRequestResult) => void)[] = []

				for (const [id, change] of changes) {
					// Avoid re-committing a change if commit is done twice in a row
					if (change.committed) {
						continue
					} else {
						change.committed = true
					}

					switch (change.operation) {
						case 'create':
							batch.collection(change.collection).create(change.data)
							result_handlers.push((result) => {
								if (isOk(result.status)) {
									// Update record from result
									records.set(id, { data: result.body })
								} else {
									// Undo change
									changes.delete(id)
								}
							})
							batched_changes.push(id)
							break

						case 'update':
							batch.collection(change.collection).update(id, change.data)
							result_handlers.push((result) => {
								if (isOk(result.status)) {
									// Update record from result
									records.set(id, { data: result.body })
								} else {
									// Undo change
									changes.delete(id)
								}
							})
							batched_changes.push(id)
							break

						case 'delete':
							batch.collection(change.collection).delete(id)
							result_handlers.push((result) => {
								if (isOk(result.status)) {
									// Update record from result
									records.set(id, null)
								} else {
									// Undo change
									changes.delete(id)
								}
							})
							batched_changes.push(id)
							break
					}
				}

				if (batched_changes.length === 0) {
					// No changes
					return
				}

				try {
					const results = await batch.send()

					// Handle results
					for (const [index, result] of results.entries()) {
						result_handlers[index](result)
					}
				} catch (error) {
					// Undo failed changes
					for (const id of batched_changes) {
						changes.delete(id)
					}

					throw error
				}
			})
			return promise
		},
		discard: () => {
			for (const [id, change] of [...changes]) {
				if (!change.committed) {
					changes.delete(id)
				}
			}
		}
	}
}

const isOk = (statusCode: number) => statusCode >= 200 && statusCode <= 299
