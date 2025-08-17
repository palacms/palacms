<script lang="ts">
	import { flip } from 'svelte/animate'
	import * as _ from 'lodash-es'
	import UI from '$lib/builder/ui'
	import { dragging_symbol } from '$lib/builder/stores/app/misc'
	import Sidebar_Symbol from './Sidebar_Symbol.svelte'
	import Content from '../Content.svelte'
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { site_html } from '$lib/builder/stores/app/page'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Cuboid, SquarePen } from 'lucide-svelte'
	import { page as pageState } from '$app/state'
	import { PageTypes, Sites, Pages, PageEntries, manager } from '$lib/pocketbase/collections'
	import { SiteSymbols } from '$lib/pocketbase/collections'
	import { getContext } from 'svelte'
	import { setFieldEntries } from '../Fields/FieldsContent.svelte'
	import { current_user } from '$lib/pocketbase/user'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	// Get site from context (preferred) or fallback to hostname lookup
	const context_site = getContext<ObjectOf<typeof Sites>>('site')
	const host = $derived(pageState.url.host)
	const fallback_site = $derived(Sites.list({ filter: `host = "${host}"` })?.[0])
	const site = $derived(context_site || fallback_site)
	const slug = $derived(pageState.params.page)
	const page = $derived(site && slug ? Pages.list({ filter: `site = "${site.id}" && slug = "${slug}"` })?.[0] : site?.homepage())
	const page_type = $derived(page && PageTypes.one(page.page_type))
	const page_type_fields = $derived(page_type?.fields())
	const page_entries = $derived(page?.entries())
	const page_type_symbols = $derived(page_type?.symbols() ?? [])
	const available_symbols = $derived(page_type_symbols.map(({ symbol }) => SiteSymbols.one(symbol)).filter((symbol) => !!symbol))
	const has_symbols = $derived(available_symbols?.length !== 0)

	function drag_target(element, block) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ block },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDragStart() {
				$dragging_symbol = true
			},
			onDragEnd() {
				$dragging_symbol = false
			},
			onDrop({ self, source }) {
				$dragging_symbol = false
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (closestEdgeOfTarget === 'top') {
					// TODO: Implement
					throw new Error('Not implemented')
				} else if (closestEdgeOfTarget === 'bottom') {
					// TODO: Implement
					throw new Error('Not implemented')
				}
			}
		})
	}

	let commit_task
</script>

<div class="sidebar primo-reset">
	{#if has_symbols}
		<Tabs.Root value="blocks" class="p-2">
			<Tabs.List class="w-full mb-2">
				<Tabs.Trigger value="blocks" class="flex-1 flex gap-1">
					<Cuboid class="w-3" />
					<span class="text-xs">Blocks</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="content" class="flex-1 flex gap-1">
					<SquarePen class="w-3" />
					<span class="text-xs">Fields</span>
				</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="blocks">
				{@render symbols()}
			</Tabs.Content>
			<Tabs.Content value="content">
				{@render content()}
			</Tabs.Content>
		</Tabs.Root>
	{:else}
		{@render content()}
	{/if}
</div>

{#snippet symbols()}
	<div class="symbols">
		{#if $site_html !== null}
			{#each available_symbols ?? [] as symbol (symbol.id)}
				<div animate:flip={{ duration: 200 }} use:drag_target={symbol}>
					<Sidebar_Symbol {symbol} controls_enabled={false} head={$site_html} />
				</div>
			{/each}
		{:else}
			<div style="display: flex;justify-content: center;font-size: 2rem;color:var(--color-gray-6)">
				<UI.Spinner variant="loop" />
			</div>
		{/if}
	</div>
	{#if $current_user?.siteRole === 'developer'}
		<button
			onclick={() => {
				const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
				goto(`${base_path}/page-type--${page_type?.id}?tab=blocks`)
			}}
			class="footer-link"
		>
			Manage Blocks
		</button>
	{/if}
{/snippet}

{#snippet content()}
	{#if page && page_type_fields && page_entries}
		<div class="page-type-fields">
			<Content
				entity={page}
				fields={page_type_fields}
				entries={page_entries}
				oninput={(values) => {
					setFieldEntries({
						fields: page_type_fields,
						entries: page_entries,
						updateEntry: PageEntries.update,
						createEntry: (data) => PageEntries.create({ ...data, page: page.id }),
						values
					})
					clearTimeout(commit_task)
					commit_task = setTimeout(() => manager.commit(), 500)
				}}
			/>
		</div>
	{/if}
	{#if $current_user?.siteRole === 'developer'}
		<button
			onclick={() => {
				const base_path = pageState.url.pathname.startsWith('/admin/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
				goto(`${base_path}/page-type--${page_type?.id}?tab=fields`)
			}}
			class="footer-link"
		>
			Manage Fields
		</button>
	{/if}
{/snippet}

<style lang="postcss">
	.sidebar {
		width: 100%;
		/* background: #171717; */
		background: #111;
		z-index: 9;
		display: flex;
		flex-direction: column;
		height: 100%;
		flex: 1;
		/* gap: 0.5rem; */
		z-index: 9;
		position: relative;
		overflow: auto;
		/* padding-top: 0.5rem; */
	}

	.container {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 1rem;
		height: 100%;
		gap: 1rem;
	}

	.page-type-fields {
		flex: 1;
	}

	.symbols {
		gap: 1rem;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	button.footer-link {
		font-size: 0.625rem;
		text-align: right;
		text-decoration: underline;
		color: var(--color-gray-4);
	}
</style>
