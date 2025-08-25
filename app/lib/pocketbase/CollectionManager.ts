import type { ObjectWithId } from './Object'
import type { RecordService } from 'pocketbase'
import { OrderedSvelteMap } from './OrderedSvelteMap'

export type StagedOperation<T extends ObjectWithId> =
	| { collection: RecordService<T>; operation: 'create'; processed: boolean; data: Omit<T, 'id'> }
	| { collection: RecordService<T>; operation: 'update'; processed: boolean; data: Partial<T> }
	| { collection: RecordService<T>; operation: 'delete'; processed: boolean }

export type RecordIdList = {
	invalidated: boolean
	ids: string[]
}

export type CollectionManager = ReturnType<typeof createCollectionManager>

export const createCollectionManager = () => {
	const staged = new OrderedSvelteMap<string, StagedOperation<ObjectWithId>>()
	const records = new OrderedSvelteMap<string, ObjectWithId | undefined | null>()
	const lists = new OrderedSvelteMap<string, RecordIdList | undefined | null>()

	let commitsInProgress = 0

	return {
		staged,
		records,
		lists,
		commit: async () => {
			try {
				commitsInProgress++

				for (const [id, operation] of staged) {
					// Avoid redoing operation if commit is done twice in a row
					if (operation.processed) {
						continue
					} else {
						operation.processed = true
					}

					switch (operation.operation) {
						case 'create':
							await operation.collection.create(operation.data).then((record) => {
								records.set(id, record)
							})
							break

						case 'update':
							await operation.collection.update(id, operation.data).then((record) => {
								records.set(id, record)
							})
							break

						case 'delete':
							await operation.collection.delete(id).then(() => {
								records.delete(id)
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

					staged.clear()
				}
			}
		},
		discard: () => {
			staged.clear()
		}
	}
}
