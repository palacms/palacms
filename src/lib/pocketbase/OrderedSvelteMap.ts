import { SvelteMap } from 'svelte/reactivity'

/**
 * SvelteMap that determines order based initial "set" call. Calls to set with
 * existing id, aka. overwrites, does not change the order.
 */
export class OrderedSvelteMap<K, V> extends SvelteMap<K, V> {
	private order: K[] = []

	private iterator() {
		const map = this
		return Iterator.from({
			*[Symbol.iterator]() {
				for (const key of map.order) {
					const value = map.get(key)
					yield [key, value] as [K, V]
				}
			}
		})
	}

	forEach(callbackfn: (value: V, key: K, thisArg?: any) => void): void {
		this.entries().forEach(([key, value]) => callbackfn(value, key, this))
	}

	set(key: K, value: V): this {
		if (!this.order.includes(key)) {
			this.order.push(key)
		}

		super.set(key, value)
		return this
	}

	delete(key: K): boolean {
		this.order = this.order.filter((k) => k !== key)
		return super.delete(key)
	}

	clear(): void {
		this.order = []
		super.clear()
	}

	keys() {
		super.keys()
		return this.iterator().map(([key]) => key)
	}

	values() {
		super.values()
		return this.iterator().map(([, value]) => value)
	}

	entries() {
		super.entries()
		return this.iterator()
	}

	[Symbol.iterator]() {
		return this.entries()
	}
}
