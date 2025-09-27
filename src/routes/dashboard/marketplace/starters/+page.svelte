<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { Separator } from '$lib/components/ui/separator'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { LayoutTemplate } from 'lucide-svelte'
	import MarketplaceStarterButton from '$lib/components/MarketplaceStarterButton.svelte'
	import { page } from '$app/state'
	import { MarketplaceSiteGroups, MarketplaceSites } from '$lib/pocketbase/collections'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { goto } from '$app/navigation'

	const group_id = $derived(page.url.searchParams.get('group') ?? undefined)
	const starters = $derived(group_id ? (MarketplaceSites.list({ filter: { group: group_id }, sort: 'index' }) ?? undefined) : undefined)

	// Auto-select first group if none is selected
	$effect(() => {
		const groups = MarketplaceSiteGroups.list({ sort: 'index' }) ?? []
		if (!group_id && groups.length > 0) {
			const url = new URL(page.url)
			url.searchParams.set('group', groups[0].id)
			goto(url, { replaceState: true })
		}
	})
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">Starter Sites</div>
	</div>
</header>
<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#key group_id}
		{#if starters?.length || starters === undefined}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#if starters === undefined}
					{#each Array.from({ length: 8 }) as _}
						<Skeleton class="aspect-video w-full" />
					{/each}
				{:else}
					{#each starters as site (site.id)}
						<MarketplaceStarterButton {site} />
					{/each}
				{/if}
			</div>
		{:else}
			<EmptyState class="h-[50vh]" icon={LayoutTemplate} title="No Starters to display" description="Starters are starting points for your sites. When you create one it'll show up here." />
		{/if}
	{/key}
</div>
