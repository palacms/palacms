import type { ObjectWithId } from './Object'
import type { RecordService } from 'pocketbase'
import { OrderedSvelteMap } from './OrderedSvelteMap'
import type Client from 'pocketbase'

export type Change<T extends ObjectWithId> =
	| { collection: RecordService<T>; operation: 'create'; committed: boolean; data: Omit<T, 'id'> }
	| { collection: RecordService<T>; operation: 'update'; committed: boolean; data: Partial<T> }
	| { collection: RecordService<T>; operation: 'delete'; committed: boolean }

export type TrackedRecord = {
	data: ObjectWithId
}

export type TrackedList = {
	invalidated: boolean
	ids: string[]
}

export type CollectionManager = ReturnType<typeof createCollectionManager>

export const createCollectionManager = (instance: Client) => {
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
			promise = promise.finally(async () => {
				for (const [id, change] of changes) {
					// Avoid re-committing a change if commit is done twice in a row
					if (change.committed) {
						continue
					} else {
						change.committed = true
					}

					switch (change.operation) {
						case 'create':
							await change.collection.create(change.data).then((record) => {
								records.set(id, { data: record })
							})
							break

						case 'update':
							await change.collection.update(id, change.data).then((record) => {
								records.set(id, { data: record })
							})
							break

						case 'delete':
							await change.collection.delete(id).then(() => {
								records.set(id, null)
							})
							break
					}
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
