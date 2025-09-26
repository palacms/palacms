<script lang="ts">
	import IFrame from '$lib/builder/components/IFrame.svelte'
	import { LibrarySymbols } from '$lib/pocketbase/collections'
	import { block_html } from '$lib/builder/code_generators'
	import type { Snippet } from 'svelte'
	import { locale } from '$lib/builder/stores/app'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { useContent } from '$lib/Content.svelte'

	/** @type {Props} */
	let {
		symbol,
		onclick,
		children = null
	}: {
		symbol: ObjectOf<typeof LibrarySymbols>
		onclick?: () => void
		children?: null | Snippet
	} = $props()

	const code = $derived(
		symbol && {
			html: symbol.html,
			css: symbol.css,
			js: symbol.js
		}
	)
	const _data = $derived(useContent(symbol, { target: 'cms' }))
	const data = $derived(_data && (_data[$locale] ?? {}))

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
	{#if symbol?.name || children}
		<div class="w-full p-3 pt-2 bg-gray-900 truncate flex items-center justify-between">
			{#if symbol?.name}
				<div class="text-xs leading-none truncate" style="width: calc(100% - 2rem)">{symbol?.name}</div>
			{/if}
			{#if children}
				<div>
					{@render children()}
				</div>
			{/if}
		</div>
	{/if}
</div>
