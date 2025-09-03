<script lang="ts">
	import { fade } from 'svelte/transition'
	import * as _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import { processCode } from '../utils'
	import IFrame from '../components/IFrame.svelte'
	import type { SiteSymbol } from '$lib/common/models/SiteSymbol'
	import type { LibrarySymbol } from '$lib/common/models/LibrarySymbol'
	import type { Symbol } from '$lib/common/models/Symbol'
	import { site_context } from '$lib/builder/stores/context'
	import { useContent } from '$lib/Content.svelte'
	import { locale } from '$lib/builder/stores/app/misc'

	let { symbol = $bindable(), checked = false, onclick }: { symbol: SiteSymbol | LibrarySymbol; checked?: boolean; onclick?: () => void } = $props()

	const site = site_context.getOr(null)
	const _data = $derived(useContent(symbol))
	const data = $derived(_data && (_data[$locale] ?? {}))

	let name_el

	let height = $state(0)

	let componentCode = $state()
	let component_error = $state()
	async function compile_component_code(symbol: Symbol) {
		if (!site) return
		let res = await processCode({
			component: {
				head: site.head,
				css: symbol.css,
				html: symbol.html,
				data
			},
			buildStatic: true,
			hydrated: true
		})
		if (res.error) {
			component_error = res.error
		} else {
			component_error = null
			res.html = res.html + res.head
			componentCode = res
		}
	}

	// move cursor to end of name
	$effect(() => {
		if (name_el) {
			const range = document.createRange()
			const sel = window.getSelection()
			range.setStart(name_el, 1)
			range.collapse(true)

			sel?.removeAllRanges()
			sel?.addRange(range)
		}
	})
	$effect.pre(() => {
		compile_component_code(symbol)
	})
</script>

<button class="sidebar-symbol" {onclick}>
	<div class="symbol">
		{#if checked}
			<div class="check" in:fade={{ duration: 100 }}>
				<Icon icon="material-symbols:check" />
			</div>
		{/if}
		{#if component_error}
			<div class="error">
				<Icon icon="bxs:error" />
			</div>
		{:else}
			{#key componentCode}
				<IFrame bind:height {componentCode} />
			{/key}
		{/if}
	</div>
</button>

<style lang="postcss">
	.sidebar-symbol {
		width: 100%;
		--IconButton-opacity: 0;

		&:hover:not(.dragging) {
			--IconButton-opacity: 1;
		}

		.symbol {
			width: 100%;
			border-radius: 0.25rem;
			overflow: hidden;
			position: relative;
			min-height: 2rem;
			transition: box-shadow 0.2s;
			border: 1px solid var(--color-gray-8);
		}
	}
	.check {
		position: absolute;
		inset: 0;
		z-index: 9;
		background: rgba(0, 0, 0, 0.9);
		font-size: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--weave-primary-color);
	}
	.error {
		display: flex;
		justify-content: center;
		height: 100%;
		position: absolute;
		inset: 0;
		align-items: center;
		background: #ff0000;
	}
</style>
