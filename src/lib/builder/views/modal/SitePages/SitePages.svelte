<script lang="ts">
	import { page as pageState } from '$app/state'
	import * as Dialog from '$lib/components/ui/dialog'
	import Item from './Item.svelte'
	import PageForm from './PageForm.svelte'
	import Icon from '@iconify/svelte'
	import { Pages, PageTypes, PageSections, PageSectionEntries } from '$lib/pocketbase/collections'
	import { resolve_page } from '$lib/pages'
	import { site_context } from '$lib/builder/stores/context'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import type { Page } from '$lib/common/models/Page'
	import { self } from '$lib/pocketbase/managers'
	import { fade } from 'svelte/transition'

	let hover_position = $state(null)

	// Get site from context (preferred) or fallback to hostname lookup
	const { value: site } = site_context.get()
	const page_slug = $derived(pageState.params.page)
	const current_path = $derived(pageState.params.page?.split('/'))
	const active_page = $derived(current_path ? resolve_page(site, current_path) : site.homepage())

	const homepage = $derived(site.homepage())
	const all_pages = $derived(site.pages() ?? [])
	const root_pages = $derived(homepage?.children() || [])

	// WORKAROUND: For some reason Svelte does not track all_pages if it's not a dependency for an effect.
	// maybe putting site in context fixes this?
	// $effect(() => {
	// 	all_pages
	// })

	let creating_page = $state(false)
	let building_page = $state(false)
	let building_page_name = $state('')
	let new_page = $state<ObjectOf<typeof Pages>>()
	let new_page_page_type = $derived(new_page && PageTypes.one(new_page.page_type))
	let new_page_page_type_sections = $derived(new_page_page_type?.sections())
	let new_page_page_type_section_entries = $derived(new_page_page_type_sections?.every((section) => section.entries()) && new_page_page_type_sections?.flatMap((section) => section.entries() ?? []))

	// Copy page sections to new page
	$effect(() => {
		if (!new_page || !new_page_page_type_sections || !new_page_page_type_section_entries) {
			return
		}

		building_page = true

		for (const pts of new_page_page_type_sections) {
			// Skip header and footer sections - these are handled at the site level
			if (pts.zone === 'header' || pts.zone === 'footer') {
				continue
			}
			// Create the page section
			const page_section = PageSections.create({
				page: new_page.id,
				symbol: pts.symbol,
				index: pts.index
			})

			// Find and copy only root-level entries (parent = null/empty)
			const page_type_section_entries = new_page_page_type_section_entries.filter((e) => !e.parent).filter((e) => e.section === pts.id)
			for (const ptse of page_type_section_entries) {
				PageSectionEntries.create({
					section: page_section.id,
					field: ptse.field,
					locale: ptse.locale,
					value: ptse.value,
					index: ptse.index
				})
			}
		}

		new_page = undefined
		self.commit()
		building_page = false
	})

	/**
	 * Create a page and copy all page type sections to it
	 * Note: Only copies root-level entries for now, nested entries are handled on-demand
	 */
	async function create_page_with_sections(page_data: Omit<Page, 'id' | 'index'>) {
		// Get existing siblings and find the max index
		const sibling_pages = all_pages.filter((page) => page.parent === page_data.parent)
		const maxIndex = sibling_pages.length > 0 ? Math.max(...sibling_pages.map((p) => p.index)) : -1
		const new_index = maxIndex + 1

		// Create the page with the next available index
		new_page = Pages.create({
			...page_data,
			index: new_index
		})
	}
</script>

<Dialog.Header title="Pages ({all_pages.length})" />
{#if active_page}
	<ul class="grid p-2 bg-[var(--primo-color-black)] page-list">
		{#each [homepage, ...root_pages].sort((a, b) => a.index - b.index) as page, i (page.id)}
			<li transition:fade={{ duration: 100 }}>
				<Item {page} {page_slug} active_page_id={!pageState.params.page_type ? active_page.id : null} oncreate={create_page_with_sections} bind:hover_position />
				<div class="drop-indicator-inline" class:active={hover_position === `${page.id}-bottom`}><div></div></div>
			</li>
		{/each}
		{#if building_page}
			<li class="building-placeholder">
				<div class="building-page-item">
					<Icon icon="eos-icons:three-dots-loading" />
					<span>Building {building_page_name} Page</span>
				</div>
			</li>
		{/if}
	</ul>

	{#if creating_page}
		<div class="p-2 bg-[var(--primo-color-black)]">
			<PageForm
				oncreate={async (new_page: Omit<Page, 'id' | 'parent' | 'site' | 'index'>) => {
					creating_page = false
					const url_taken = all_pages.some((page) => page?.slug === new_page.slug && page.parent === homepage.id)
					if (url_taken) {
						alert(`That URL is already in use`)
					} else {
						building_page = true
						building_page_name = new_page.name
						await create_page_with_sections({ ...new_page, parent: homepage.id, site: site.id })
					}
				}}
			/>
		</div>
	{:else}
		<div class="p-2 bg-[var(--primo-color-black)]">
			<button class="create-page-btn" onclick={() => (creating_page = true)}>
				<Icon icon="akar-icons:plus" />
				<span>Create Page</span>
			</button>
		</div>
	{/if}
{/if}

<style lang="postcss">
	.page-list {
		gap: 0.5rem;
		overflow: auto;

		> li {
			position: relative;
		}

		.drop-indicator-inline {
			height: 4px;
			display: flex;
			align-items: center;
			padding: 0 8px;
			position: absolute;
			bottom: -6px;
			left: 0;
			right: 0;
			z-index: 10;

			div {
				width: 100%;
				height: 2px;
				background: transparent;
				border-radius: 1px;
				transition: all 0.2s ease;
				opacity: 0;
			}

			&.active div {
				opacity: 1;
				background: var(--pala-primary-color);
				height: 3px;
				animation: pulse 0.6s ease-in-out infinite;
			}
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.create-page-btn {
		font-size: 0.75;
		width: 100%;
		padding: 0.5rem 1.125rem;
		background: #1a1a1a;
		border-radius: var(--primo-border-radius);
		display: flex;
		justify-content: center;
		gap: 0.25rem;
		align-items: center;
		transition: 0.1s;
		color: var(--color-gray-3);

		&:hover {
			border-color: var(--pala-primary-color);
			color: var(--pala-primary-color);
		}
	}

	.building-page-item {
		background: #1a1a1a;
		border: 1px dashed var(--color-gray-6);
		border-radius: var(--primo-border-radius);
		padding: 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--color-gray-3);
		font-size: 0.875rem;

		:global(svg) {
			height: 1rem;
			width: 1rem;
		}
	}
</style>
