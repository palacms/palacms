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
	filter?: Record<string, string>
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
	one: (id: string) => MappedObject<T, Options> | undefined | null
	list: (options?: ListOptions) => MappedObjectList<T, Options> | undefined | null
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
	const { changes, records, lists } = manager

	const mapObject = (record: unknown): MappedObject<T, Options> => {
		const object = model.parse(record)
		const links = Object.fromEntries(
			Object.entries(options?.links ?? {}).map(([property, factory]) => [property, factory.bind({ ...object, collection: collectionMapping, values: () => ({ ...object }) })])
		)
		return Object.assign({}, object, links, { collection: collectionMapping, values: () => ({ ...object }) })
	}

	const collectionMapping: CollectionMapping<T, Options> = {
		one: (id) => {
			const change = changes.get(id)
			let data = records.get(id)

			if (change && change.operation === 'delete') {
				return undefined
			} else if (change) {
				data = Object.assign({}, data, change.data)
			} else if (!data) {
				$effect(() => {
					// If no cached record exists, start loading it
					if (!records.has(id)) {
						untrack(() => {
							records.set(id, undefined)
							collection
								.getOne(id)
								.then((record) => {
									records.set(id, record as unknown as T)
								})
								.catch((error) => {
									console.error(error)
									records.set(id, null)
								})
						})
					}
				})
				return data
			}

			return mapObject(data)
		},
		list: (options) => {
			const listId = name + JSON.stringify(options ?? {})

			const filter = Object.entries(options?.filter ?? {})
				.map(([key, value]) => `${key} = "${value}"`)
				.join(' && ')

			$effect(() => {
				// If no cached list exists or it's invalidated, start loading it
				const existingList = lists.get(listId)
				if (!lists.has(listId) || existingList?.invalidated) {
					untrack(() => {
						lists.set(listId, existingList ? { invalidated: false, ids: existingList?.ids } : undefined)
						collection
							.getFullList({
								...options,
								filter,
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
							.catch((error) => {
								console.error(error)
								lists.set(listId, null)
							})
					})
				}
			})

			const list = [...(lists.get(listId)?.ids ?? [])]
			for (const [id, change] of changes) {
				if (change.collection !== collection) {
					// The change is not for this collection
					continue
				}

				// Only add non-deleted items to the list
				if (change.operation !== 'delete' && !list.includes(id)) {
					list.push(id)
				}
			}

			const originalList = lists.get(listId)
			const objects = list
				.map((id) => collectionMapping.one(id))
				.filter((object) => !!object)
				.filter((object) => {
					const values = object.values()
					for (const [key, value] of Object.entries(options?.filter ?? {})) {
						if (key.includes('.')) {
							// Ignore condition refering to a referenced collection. If that kind of
							// filter is used, filtering must be manually handled.
							continue
						}
						if (values[key] !== value) {
							return false
						}
					}
					return true
				})
			if (lists.has(listId) && !originalList) {
				return originalList
			} else if (!originalList && objects.length === 0) {
				return undefined
			} else {
				return objects
			}
		},
		create: (values) => {
			const id = generateId()
			const data = { ...values, id }
			changes.set(id, { collection, operation: 'create', committed: false, data })
			return mapObject(data)
		},
		update: (id, values) => {
			let change = changes.get(id)
			if (change && change.operation !== 'delete' && !change.committed) {
				// Create a new operation object to ensure reactivity
				const updatedChange =
					// Separate (duplicate) cases for each operation type to satify TypeScript
					change.operation == 'create'
						? {
								collection,
								operation: change.operation,
								committed: false,
								data: { ...change.data, ...values }
							}
						: {
								collection,
								operation: change.operation,
								committed: false,
								data: { ...change.data, ...values }
							}
				changes.set(id, updatedChange)
			} else {
				change = { collection, operation: 'update', committed: false, data: values }
				changes.set(id, change)
			}

			let data = records.get(id)
			data = Object.assign({}, data, change.data)
			return mapObject(data)
		},
		delete: (id) => {
			const change = changes.get(id)
			if (change?.operation === 'create' && !change.committed) {
				changes.delete(id)
			} else {
				changes.set(id, { collection, operation: 'delete', committed: false })
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
