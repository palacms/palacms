<script lang="ts">
	import IFrame from '$lib/builder/components/IFrame.svelte'
	import { LibrarySymbols } from '$lib/pocketbase/collections'
	import { block_html } from '$lib/builder/code_generators'
	import type { Snippet } from 'svelte'
	import { getContent } from '$lib/pocketbase/content'
	import { locale } from '$lib/builder/stores/app'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	/** @type {Props} */
	let {
		symbol,
		onclick,
		children
	}: {
		symbol: ObjectOf<typeof LibrarySymbols>
		onclick?: () => void
		children: Snippet
	} = $props()

	const code = $derived(
		symbol && {
			html: symbol.html,
			css: symbol.css,
			js: symbol.js
		}
	)
	const fields = $derived(symbol?.fields())
	const entries = $derived(symbol?.entries())
	const data = $derived(symbol && fields && entries && (getContent(symbol, fields, entries)[$locale] ?? {}))

	let generated_code = $state()
	$effect(() => {
		if (!code || !data) {
			return
		}

		block_html({ code, data })
			.then((res) => {
				generated_code = res
			})
			.catch((error) => {
				console.error('Failed to generate symbol preview:', error)
			})
	})
</script>

<div class="relative w-full bg-gray-900 rounded-bl rounded-br">
	<button {onclick} class="w-full rounded-tl rounded-tr overflow-hidden">
		<IFrame componentCode={generated_code} />
	</button>
	<div class="w-full p-3 pt-2 bg-gray-900 truncate flex items-center justify-between">
		<div class="text-sm font-medium leading-none truncate" style="width: calc(100% - 2rem)">{symbol?.name}</div>
		<div>
			{@render children()}
		</div>
	</div>
</div>
