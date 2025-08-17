import type { default as PocketBase, RecordAuthResponse } from 'pocketbase'
import type { z } from 'zod'
import { self } from './PocketBase'
import { customAlphabet } from 'nanoid'
import { untrack } from 'svelte'
import type { ObjectWithId } from './Object'
import type { CollectionManager } from './CollectionManager'

export type ObjectOf<T> = T extends CollectionMapping<infer Object, infer Options> ? MappedObject<Object, Options> : never

export type MappedObject<T extends ObjectWithId, Options extends CollectionMappingOptions<T>> = T &
	NonNullable<Options['links']> & { collection: CollectionMapping<T, CollectionMappingOptions<T>>; values: () => T }

export type MappedObjectList<T extends ObjectWithId, Options extends CollectionMappingOptions<T>> = MappedObject<T, Options>[]

export type ListOptions = {
	sort?: string
	filter?: string
}

export type CollectionMappingOptions<T extends ObjectWithId> = {
	instance?: PocketBase
	links?: Record<string, (this: MappedObject<T, { links: {} }>) => unknown>
}

export type StagedOperation<T extends ObjectWithId> =
	| { operation: 'create'; processed: boolean; data: Omit<T, 'id'> }
	| { operation: 'update'; processed: boolean; data: Partial<T> }
	| { operation: 'delete'; processed: boolean }

export type CollectionMapping<T extends ObjectWithId, Options extends CollectionMappingOptions<T>> = {
	one: (id: string) => MappedObject<T, Options> | undefined
	list: (options?: ListOptions) => MappedObjectList<T, Options> | undefined
	create: (values: Omit<T, 'id'> & { id?: string }) => MappedObject<T, Options>
	update: (id: string, values: Partial<T>) => MappedObject<T, Options>
	delete: (id: string) => void
	authWithPassword: (usernameOrEmail: string, password: string) => Promise<RecordAuthResponse<MappedObject<T, Options>>>
	requestPasswordReset: (email: string) => Promise<void>
	confirmPasswordReset: (passwordResetToken: string, password: string, passwordConfirm: string) => Promise<void>
	from: (instance: PocketBase) => CollectionMapping<T, Options>
	instance: PocketBase
}

const generateId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 15)

export const createCollectionMapping = <T extends ObjectWithId, Options extends CollectionMappingOptions<T>>(
	name: string,
	model: z.ZodType<T>,
	manager: CollectionManager,
	options?: Options
): CollectionMapping<T, Options> => {
	const instance = options?.instance ?? self
	const instanceCache = new Map<PocketBase, CollectionMapping<T, Options>>()
	const collection = instance.collection(name)
	const { staged, records, lists } = manager

	const mapObject = (record: unknown): MappedObject<T, Options> => {
		const object = model.parse(record)
		const links = Object.fromEntries(
			Object.entries(options?.links ?? {}).map(([property, factory]) => [property, factory.bind({ ...object, collection: collectionMapping, values: () => ({ ...object }) })])
		)
		return Object.assign({}, object, links, { collection: collectionMapping, values: () => ({ ...object }) })
	}

	const collectionMapping: CollectionMapping<T, Options> = {
		one: (id) => {
			const operation = staged.get(id)
			let data = records.get(id)

			if (operation && operation.operation === 'delete') {
				return undefined
			} else if (operation && !operation.processed) {
				data = Object.assign({}, data, operation.data)
			} else if (!data) {
				$effect(() => {
					// If no cached record exists, start loading it
					if (!records.has(id)) {
						untrack(() => {
							records.set(id, undefined)
							collection.getOne(id).then((record) => {
								records.set(id, record as unknown as T)
							})
						})
					}
				})
				return undefined
			}

			return mapObject(data)
		},
		list: (options) => {
			const listId = name + JSON.stringify(options ?? {})

			$effect(() => {
				// If no cached list exists or it's invalidated, start loading it
				const existingList = lists.get(listId)
				if (!lists.has(listId) || existingList?.invalidated) {
					untrack(() => {
						lists.set(listId, existingList ? { invalidated: false, ids: existingList?.ids } : undefined)
						collection
							.getFullList({
								...options,
								requestKey: listId
							})
							.then((fetchedRecords) => {
								// Store the full records
								fetchedRecords.forEach((record) => {
									records.set(record.id, record as unknown as T)
								})
								// Store the list of IDs
								lists.set(listId, { invalidated: false, ids: fetchedRecords.map(({ id }) => id) })
							})
							.catch(() => {
								lists.set(listId, undefined)
							})
					})
				}
			})

			const list = [...(lists.get(listId)?.ids ?? [])]
			for (const [id, value] of staged) {
				if (value.collection !== collection) {
					// The operation is not for this collection
					continue
				}

				// Only add non-deleted and non-processed staged items to the list
				if (value.operation !== 'delete' && !value.processed && !list.includes(id)) {
					list.push(id)
				}
			}

			const objects = list.map((id) => collectionMapping.one(id)).filter((object) => object !== undefined)
			if ((!lists.has(listId) || lists.get(listId) === undefined) && objects.length === 0) {
				return undefined
			} else {
				return objects
			}
		},
		create: (values) => {
			const id = generateId()
			const data = { ...values, id }
			staged.set(id, { collection, operation: 'create', processed: false, data })
			return mapObject(data)
		},
		update: (id, values) => {
			let operation = staged.get(id)
			if (operation && operation.operation !== 'delete') {
				// Create a new operation object to ensure reactivity
				const updatedOperation =
					// Separate (duplicate) cases for each operation type to satify TypeScript
					operation.operation == 'create'
						? {
								collection,
								operation: operation.operation,
								processed: false,
								data: { ...operation.data, ...values }
							}
						: {
								collection,
								operation: operation.operation,
								processed: false,
								data: { ...operation.data, ...values }
							}
				staged.set(id, updatedOperation)
			} else {
				operation = { collection, operation: 'update', processed: false, data: values }
				staged.set(id, operation)
			}

			let data = records.get(id)
			data = Object.assign({}, data, operation.data)
			return mapObject(data)
		},
		delete: (id) => {
			const operation = staged.get(id)
			if (operation?.operation === 'create' && !operation.processed) {
				staged.delete(id)
			} else {
				staged.set(id, { collection, operation: 'delete', processed: false })
			}
		},
		authWithPassword: async (usernameOrEmail, password) => {
			const response = await collection.authWithPassword(usernameOrEmail, password)
			records.set(response.record.id, response.record as unknown as T)

			// Clear loaded data because authorization has been updated.
			lists.clear()
			records.clear()

			return { ...response, record: mapObject(response.record) }
		},
		requestPasswordReset: async (email) => {
			await collection.requestPasswordReset(email)
		},
		confirmPasswordReset: async (passwordResetToken, password, passwordConfirm) => {
			await collection.confirmPasswordReset(passwordResetToken, password, passwordConfirm)
		},
		from: (instance: PocketBase) => {
			const cachedCollectionMapping = instanceCache.get(instance)
			if (cachedCollectionMapping) {
				return cachedCollectionMapping
			}
			const collectionMapping = createCollectionMapping(name, model, manager, { ...options, instance })
			instanceCache.set(instance, collectionMapping)
			return collectionMapping
		},
		instance
	}

	instanceCache.set(instance, collectionMapping)
	return collectionMapping
}
