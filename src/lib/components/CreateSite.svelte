<script lang="ts">
	import { Loader, Globe, Store, Check, SquarePen, Cuboid, ExternalLink } from 'lucide-svelte'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Input } from '$lib/components/ui/input/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import { Site } from '$lib/common/models/Site'
	import { Sites, SiteSymbols, SiteSymbolFields, SiteSymbolEntries, SiteGroups, LibrarySymbols } from '$lib/pocketbase/collections'
	import { page as pageState } from '$app/state'
	import Button from './ui/button/button.svelte'
	import { create_site_symbol_entries, create_site_symbol_fields, create_site_symbols, useCloneSite } from '$lib/workers/CloneSite.svelte'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Skeleton } from '$lib/components/ui/skeleton/index.js'
	import { self as pb, marketplace, self } from '$lib/pocketbase/managers'
	import { watch } from 'runed'
	import BlockPickerPanel from '$lib/components/BlockPickerPanel.svelte'

	/*
  Create Site Wizard
  - Steps: name → starter → blocks
  - Flow: clone the selected starter, then optionally copy selected blocks.
  - Data sources: local PocketBase (manager/self) and marketplace (marketplace).
  - Commit: aggregate creates and call self.commit() once per creation.
*/

	const { oncreated }: { oncreated?: () => void } = $props()

	const all_site_groups = $derived(SiteGroups.list({ sort: 'index' }) ?? [])
	// Prefer group named "Default"; otherwise fall back to the first group.
	const site_group = $derived(all_site_groups?.find((g) => g.name === 'Default') || all_site_groups?.[0])

	// Keep undefined until loaded so we can show skeletons
	const starter_sites = $derived(Sites.list({ sort: 'index' }) ?? undefined)
	// Starter groups sidebar state
	let active_starters_group_id = $state(all_site_groups?.[0]?.id ?? '')
	// When groups load/update, pick first available if none selected.
	watch(
		() => (all_site_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_starters_group_id && ids.length > 0) {
				active_starters_group_id = ids[0]
			}
		}
	)

	const active_starters_group_sites = $derived(starter_sites ? (active_starters_group_id ? starter_sites.filter((s) => s.group === active_starters_group_id) : starter_sites) : undefined)

	// Marketplace (Starters) - site groups and sites
	const marketplace_site_groups = $derived(SiteGroups.from(marketplace).list({ sort: 'index' }) ?? [])
	let active_marketplace_starters_group_id = $state(marketplace_site_groups?.find((g) => g.name === 'Featured')?.id ?? marketplace_site_groups?.[0]?.id ?? '')
	watch(
		() => (marketplace_site_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_marketplace_starters_group_id && ids.length > 0) {
				const groups = marketplace_site_groups ?? []
				active_marketplace_starters_group_id = groups.find((g) => g.name === 'Featured')?.id ?? ids[0]
			}
		}
	)

	const marketplace_starter_sites = $derived(
		active_marketplace_starters_group_id
			? (Sites.from(marketplace).list({ filter: { group: active_marketplace_starters_group_id }, sort: 'index' }) ?? undefined)
			: (Sites.from(marketplace).list({ sort: 'index' }) ?? undefined)
	)

	let site_name = $state(``)

	// Eagerly compute and load derived data when this component mounts
	$effect(() => {
		void all_site_groups
		void starter_sites
		void active_starters_group_sites
		void marketplace_site_groups
		void marketplace_starter_sites
	})

	// Stepper action: advance through steps; create on final step.
	function next_or_create() {
		if (step === 'name') {
			if (can_go_starter) step = 'starter'
			return
		}
		if (step === 'starter') {
			if (can_go_blocks) step = 'blocks'
			return
		}
		if (step === 'blocks') {
			create_site()
		}
	}

	let starter_tab = $state('sites')
	let selected_starter_id = $state(``)
	let selected_starter_source = $state<'local' | 'marketplace'>('local')
	// Select a starter site by id and source.
	function select_starter(site_id: string, source: 'local' | 'marketplace' = 'local') {
		selected_starter_id = site_id
		selected_starter_source = source
	}

	const selected_starter_site = $derived(
		selected_starter_source === 'local' ? (starter_sites ?? []).find((site) => site.id === selected_starter_id) : (marketplace_starter_sites ?? []).find((site) => site.id === selected_starter_id)
	)

	// Stepper state
	const step_order = ['name', 'starter', 'blocks'] as const
	let step = $state<(typeof step_order)[number]>('name')
	const can_go_starter = $derived(!!site_name)
	const can_go_blocks = $derived(!!site_name && !!selected_starter_id)

	// Optional blocks selection; keep resolved symbol pointers only.
	let selected_block_ids = $state<{ id: string; source: 'library' | 'marketplace' }[]>([])
	const selected_blocks = $derived(selected_block_ids.map(({ id, source }) => (source === 'library' ? LibrarySymbols.one(id) : LibrarySymbols.from(marketplace).one(id))).filter(Boolean) || [])
	const selected_block_fields = $derived(selected_blocks.flatMap((symbol) => symbol?.fields()))
	const selected_block_entries = $derived(selected_blocks.flatMap((symbol) => symbol?.entries()))

	async function copy_selected_blocks_to_site() {
		try {
			if (!selected_block_ids.length) return

			const site = created_site
			const source_symbols = selected_blocks.filter((symbol) => !!symbol)
			const source_symbol_fields = selected_block_fields.filter((field) => !!field)
			const source_symbol_entries = selected_block_entries.filter((entry) => !!entry)

			const site_symbol_map = create_site_symbols({ source_symbols, site })
			const site_symbol_field_map = create_site_symbol_fields({ source_symbol_fields, site_symbol_map })
			const site_symbol_entry_map = create_site_symbol_entries({ source_symbol_entries, site_symbol_field_map })
		} catch (error) {
			console.error('Error copying marketplace symbols:', error)
			throw error
		}
	}

	const cloneSite = $derived(
		useCloneSite({
			source_manager: selected_starter_source === 'local' ? self : marketplace,
			source_site_id: selected_starter_id,
			site_name: site_name,
			site_host: pageState.url.host,
			site_group_id: site_group?.id
		})
	)

	let completed = $derived(Boolean(site_name && selected_starter_id))
	let loading = $state(false)

	// Clone the selected starter
	async function create_site() {
		if (!selected_starter_id) return
		loading = true
		try {
			if (!site_group) {
				SiteGroups.create({ name: 'Default', index: 0 })
			}
			await cloneSite.run()
			done_creating_site = true
		} catch (e) {
			console.error(e)
			loading = false
		}
	}

	// Find the created site for this host
	const created_sites = $derived(Sites.list({ filter: { host: pageState.url.host } }) ?? [])
	const created_site = $derived(created_sites.find((s) => s.name === site_name) ?? created_sites[0])

	// Finalize created site: copy optional blocks, and commit once.
	// Calls oncreated() when finished.
	let done_creating_site = $state(false)
	let finalized = false
	$effect(() => {
		if (!finalized && done_creating_site && created_site) {
			finalized = true
			copy_selected_blocks_to_site()
				.then(() => self.commit())
				.then(() => oncreated?.())
				.catch((e) => console.error(e))
				.finally(() => {
					loading = false
				})
		}
	})
</script>

<div class="max-w-[1400px] h-screen px-2 flex flex-col mx-auto">
	<!-- Header -->
	<div class="pt-6 pb-6 h-[12vh] min-h-[7rem]">
		<h1 class="text-md leading-none tracking-tight text-center">Create Site</h1>

		<!-- Stepper -->
		<div class="max-w-[900px] mx-auto mt-4 flex items-center gap-4 overflow-x-auto whitespace-nowrap w-full">
			<!-- Step 1 -->
			<button class="flex items-center gap-3 focus:outline-none whitespace-nowrap" onclick={() => (step = 'name')}>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('name')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if can_go_starter}
						<Check class="w-4 h-4" />
					{:else}
						<SquarePen class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'name' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Enter Name</span>
			</button>

			<div class="border-t border-border h-px flex-1"></div>

			<!-- Step 2 -->
			<button
				class="flex items-center gap-3 focus:outline-none whitespace-nowrap {can_go_starter ? '' : 'opacity-50 pointer-events-none'}"
				onclick={() => (step = 'starter')}
				disabled={!can_go_starter}
			>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('starter')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if can_go_blocks}
						<Check class="w-4 h-4" />
					{:else}
						<Globe class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'starter' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Choose a Starter</span>
			</button>
			<div class="border-t border-border h-px flex-1"></div>

			<!-- Step 3 -->
			<button class="flex items-center gap-3 focus:outline-none whitespace-nowrap {can_go_blocks ? '' : 'opacity-50 pointer-events-none'}" onclick={() => (step = 'blocks')} disabled={!can_go_blocks}>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('blocks')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if selected_block_ids.length > 0}
						<Check class="w-4 h-4" />
					{:else}
						<Cuboid class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'blocks' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Add Blocks (optional)</span>
			</button>
		</div>
	</div>

	<!-- Content -->
	{#if step === 'name'}
		<!-- Identity -->
		<div class="rounded-lg border bg-[#111] p-4 shadow-sm w-full max-w-lg mx-auto">
			<form
				class="grid w-full items-center gap-1.5"
				onsubmit={(e) => {
					e.preventDefault()
					can_go_starter ? (step = 'starter') : null
				}}
			>
				<Label for="site-name">Site Name</Label>
				<Input
					type="text"
					id="site-name"
					value={site_name}
					oninput={(e) => {
						site_name = (e.currentTarget as HTMLInputElement).value.trim()
					}}
					autofocus
				/>
			</form>
		</div>
	{/if}

	{#if step === 'starter'}
		<Tabs.Root bind:value={starter_tab} class="h-[78vh] min-h-[30rem] w-full flex gap-4 flex-1 rounded-lg border bg-[#111] p-3 shadow-sm">
			<!-- Left: groups + grid -->
			<div class="flex flex-col flex-6">
				<Tabs.List
					class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full h-11 grid-cols-2 gap-1 p-1 text-sm font-semibold leading-[0.01em] dark:border dark:border-neutral-600/30"
				>
					<Tabs.Trigger value="sites" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<Globe class="h-4 w-4" />
						<span>Sites</span>
					</Tabs.Trigger>
					<Tabs.Trigger value="marketplace" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<Store class="h-4 w-4" />
						<span>Marketplace</span>
					</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="sites" class="flex overflow-hidden h-full">
					{#if active_starters_group_sites === undefined}
						<!-- Loading skeletons for local starters -->
						{#each Array.from({ length: 6 }) as _}
							<Skeleton class="aspect-video w-full" />
						{/each}
					{:else if starter_sites?.length === 0}
						<EmptyState
							class="h-full col-span-4"
							icon={Globe}
							title="No sites to display"
							description="You don't have any sites here yet. When you create one, you'll be able to use it as a starting point for other sites. In the meantime, check the marketplace."
							button={{
								label: 'Open Marketplace',
								icon: Store,
								onclick: () => (starter_tab = 'marketplace')
							}}
						/>
					{:else}
						<!-- Groups sidebar -->
						<div class="h-full md:border-r flex-1">
							<div class="p-2 text-xs text-muted-foreground">Groups</div>
							<ul class="p-2 pt-0 flex flex-col gap-1">
								{#each all_site_groups ?? [] as group (group.id)}
									<li>
										<button
											class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_starters_group_id === group.id ? 'bg-accent text-accent-foreground' : ''}"
											onclick={() => (active_starters_group_id = group.id)}
										>
											{group.name}
										</button>
									</li>
								{/each}
							</ul>
						</div>
						<!-- Server Sites grid -->
						<div class="flex-4 overflow-auto">
							{#if active_starters_group_sites?.length === 0}
								<div class="text-sm text-muted-foreground p-6 text-center">No sites in this group.</div>
							{:else if active_starters_group_sites}
								<div class="p-3 pr-0 grid gap-4 place-content-start sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
									{#each active_starters_group_sites as site}
										{@render StarterButton(site)}
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</Tabs.Content>

				<!-- Marketplace-->
				<Tabs.Content value="marketplace" class="flex overflow-hidden h-full">
					<!-- Groups sidebar -->
					<div class="h-full md:border-r flex-1">
						<div class="p-2 text-xs text-muted-foreground">Groups</div>
						<ul class="p-2 pt-0 flex flex-col gap-1">
							{#each marketplace_site_groups ?? [] as group (group.id)}
								<li>
									<button
										class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_marketplace_starters_group_id === group.id
											? 'bg-accent text-accent-foreground'
											: ''}"
										onclick={() => (active_marketplace_starters_group_id = group.id)}
									>
										{group.name}
									</button>
								</li>
							{/each}
						</ul>
					</div>
					<!-- Marketplace Sites grid -->
					<div class="flex-4 overflow-auto">
						<div class="p-3 pr-0 grid gap-4 col-span-3 place-content-start sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
							{#if marketplace_starter_sites === undefined}
								{#each Array.from({ length: 6 }) as _}
									<Skeleton class="aspect-video w-full" />
								{/each}
							{:else}
								{#each marketplace_starter_sites as site (site.id)}
									{@render StarterButton(site, 'marketplace')}
								{/each}
								{#if (marketplace_starter_sites?.length ?? 0) === 0}
									<div class="text-sm text-muted-foreground p-6 text-center">No starters in this group.</div>
								{/if}
							{/if}
						</div>
					</div>
				</Tabs.Content>
			</div>

			<!-- Right: preview takes 2/5 -->
			<div class="flex-3">
				<div class="h-[73vh] rounded-md bg-muted/20 flex flex-col overflow-hidden">
					{#if selected_starter_site}
						{@const preview_url = selected_starter_source === 'marketplace' ? `https://${selected_starter_site?.host}` : `/?_site=${selected_starter_site?.id}`}
						<div class="flex-1 min-h-0">
							{#key selected_starter_id}
								<SitePreview style="height: 100%; --thumbnail-height: 124%" site={selected_starter_site} src={selected_starter_site ? preview_url : ''} />
							{/key}
						</div>
						{#if preview_url}
							<div class="px-3 py-2 text-xs text-right text-muted-foreground relative bg-[#111]">
								<a href={preview_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 hover:text-foreground hover:underline">
									<span>Open live preview</span>
									<ExternalLink class="h-3 w-3" aria-hidden="true" />
								</a>
							</div>
						{/if}
					{:else}
						<div class="flex-1 flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
							<p class="text-xs text-muted-foreground/80 max-w-[14rem]">Choose a starter site on the left to see a live preview here.</p>
						</div>
					{/if}
				</div>
			</div>
		</Tabs.Root>
	{/if}

	{#if step === 'blocks'}
		<BlockPickerPanel bind:selected={selected_block_ids} />
	{/if}

	<!-- Footer -->
	<div class="h-[10vh] bg-background pt-4 pb-4 flex items-center z-10">
		<div class={step === 'name' ? 'w-full max-w-lg mx-auto flex justify-end gap-3' : 'w-full max-w-[1400px] mx-auto flex justify-end gap-3'}>
			<Button
				onclick={next_or_create}
				disabled={loading || (step === 'name' && !can_go_starter) || (step === 'starter' && !can_go_blocks) || (step === 'blocks' && !completed)}
				class="inline-flex justify-center items-center relative"
			>
				{#if loading}
					<Loader class="h-4 w-4 animate-spin" />
				{:else}
					{step === 'blocks' ? 'Done' : 'Next'}
				{/if}
			</Button>
		</div>
	</div>
</div>

{#snippet StarterButton(site: Site, source: 'local' | 'marketplace' = 'local')}
	<button onclick={() => select_starter(site.id, source)} class="group relative w-full aspect-[.69] rounded-lg border bg-background overflow-hidden text-left">
		<div class="relative h-full">
			<!-- Ensure preview reserves the same height as the card to avoid tall grid rows -->
			<SitePreview {site} src={source === 'marketplace' ? `https://${site.host}` : undefined} />
			{#if selected_starter_id === site.id}
				<div class="pointer-events-none absolute inset-0 bg-[#000000AA] flex items-center justify-center">
					<Check class="text-primary" />
				</div>
			{/if}
		</div>
		<div class="absolute bottom-0 w-full p-3 z-20 bg-[#000] border-t">
			<div class="flex items-center gap-2">
				<div class="text-sm leading-none truncate">{site.name}</div>
				{#if source === 'marketplace'}
					<div class="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">Free</div>
				{/if}
			</div>
		</div>
	</button>
{/snippet}
