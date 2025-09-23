import type { ObjectWithId } from './Object'
import type { RecordService } from 'pocketbase'
import { OrderedSvelteMap } from './OrderedSvelteMap'

export type Change<T extends ObjectWithId> =
	| { collection: RecordService<T>; operation: 'create'; committed: boolean; data: Omit<T, 'id'> }
	| { collection: RecordService<T>; operation: 'update'; committed: boolean; data: Partial<T> }
	| { collection: RecordService<T>; operation: 'delete'; committed: boolean }

export type RecordIdList = {
	invalidated: boolean
	ids: string[]
}

export type CollectionManager = ReturnType<typeof createCollectionManager>

export const createCollectionManager = () => {
	const changes = new OrderedSvelteMap<string, Change<ObjectWithId>>()
	const records = new OrderedSvelteMap<string, ObjectWithId | undefined | null>()
	const lists = new OrderedSvelteMap<string, RecordIdList | undefined | null>()

	let commitsInProgress = 0
	let promise = Promise.resolve()

	return {
		changes,
		records,
		lists,
		commit: async () => {
			commitsInProgress++
			promise = promise.finally(async () => {
				try {
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
									records.set(id, record)
								})
								break

							case 'update':
								await change.collection.update(id, change.data).then((record) => {
									records.set(id, record)
								})
								break

							case 'delete':
								await change.collection.delete(id).then(() => {
									records.set(id, null)
								})
								break
						}
					}
				} finally {
					commitsInProgress--
					if (commitsInProgress === 0) {
						// Invalidate all the lists when all the commits are done
						for (const [id, list] of [...lists]) {
							lists.set(id, {
								invalidated: true,
								ids: [...(list?.ids ?? [])]
							})
						}
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
