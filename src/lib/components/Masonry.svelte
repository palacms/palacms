<script lang="ts" generics="T">
	import type { Snippet } from 'svelte'
	import { Skeleton } from '$lib/components/ui/skeleton'

	interface Props<T> {
		items: T[] | undefined
		columns?: 2 | 3 | 4
		loading?: boolean
		skeletonCount?: number
		children: Snippet<[T]>
	}

	let { items, columns = 3, loading = false, skeletonCount = 8, children }: Props<T> = $props()

	// Generate random ratios for skeleton cards
	const skeleton_ratios = $derived(
		Array.from({ length: columns }, () => 
			Array.from({ length: Math.ceil(skeletonCount / columns) }, () => 0.5 + Math.random())
		)
	)

	// Split items into columns for masonry layout
	const columnized_items = $derived(
		items ? Array.from({ length: columns }, (_, i) => 
			items.filter((_, index) => index % columns === i)
		) : []
	)
</script>

<div class="masonry">
	{#if loading || items === undefined}
		{#each skeleton_ratios as column_ratios}
			<ul>
				{#each column_ratios as ratio}
					<li>
						<Skeleton class="w-full" style="aspect-ratio: {ratio}" />
					</li>
				{/each}
			</ul>
		{/each}
	{:else}
		{#each columnized_items as column}
			<ul>
				{#each column as item}
					<li>
						{@render children(item)}
					</li>
				{/each}
			</ul>
		{/each}
	{/if}
</div>

<style lang="postcss">
	.masonry {
		display: grid;
		gap: 1rem;
		grid-template-columns: 1fr 1fr;

		@media (min-width: 700px) {
			grid-template-columns: 1fr 1fr 1fr;
		}

		@media (min-width: 1200px) {
			grid-template-columns: 1fr 1fr 1fr 1fr;
		}
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>