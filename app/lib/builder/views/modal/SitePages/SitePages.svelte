<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import Item from './Item.svelte'
	import PageForm from './PageForm.svelte'
	import Icon from '@iconify/svelte'
	import { Pages, PageTypes, PageSections, PageSectionEntries, manager } from '$lib/pocketbase/collections'
	import { site_context } from '$lib/builder/stores/context'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { fade } from 'svelte/transition'

	// Get site from context (preferred) or fallback to hostname lookup
	const site = site_context.get()
	const all_pages = $derived(site?.pages() ?? [])
	const home_page = $derived(site?.homepage())
	const child_pages = $derived(home_page?.children() ?? [])

	let creating_page = $state(false)
	let new_page = $state<ObjectOf<typeof Pages>>()
	let new_page_page_type = $derived(new_page && PageTypes.one(new_page.page_type))
	let new_page_page_type_sections = $derived(new_page_page_type?.sections())
	let new_page_page_type_section_entries = $derived(new_page_page_type_sections?.every((section) => section.entries()) && new_page_page_type_sections?.flatMap((section) => section.entries() ?? []))

	$effect(() => {
		if (!new_page || !new_page_page_type_sections || !new_page_page_type_section_entries) {
			return
		}

		for (const pts of new_page_page_type_sections) {
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
		manager.commit()
	})

	/**
	 * Create a page and copy all page type sections to it
	 * Note: Only copies root-level entries for now, nested entries are handled on-demand
	 */
	async function create_page_with_sections(page_data) {
		// Calculate the next index - just use the count of existing siblings
		const sibling_pages = all_pages.filter((page) => page.parent === page_data.parent)
		const next_index = sibling_pages.length

		new_page = Pages.create({
			...page_data,
			index: next_index
		})
	}
</script>

<Dialog.Header title="Pages" />
{#if home_page}
	<ul class="grid p-2 bg-[var(--primo-color-black)]">
		<li>
			<Item page={home_page} active={false} oncreate={create_page_with_sections} />
		</li>
		{#each child_pages as child_page (child_page.id)}
			<li in:fade={{ duration: 200 }}>
				<Item page={child_page} active={false} oncreate={create_page_with_sections} />
			</li>
		{/each}
	</ul>

	{#if creating_page}
		<div class="p-2 pt-0 bg-[var(--primo-color-black)]">
			<PageForm
				oncreate={async (new_page) => {
					creating_page = false
					const url_taken = all_pages.some((page) => page?.slug === new_page.slug)
					if (url_taken) {
						alert(`That URL is already in use`)
					} else {
						await create_page_with_sections({ ...new_page, parent: home_page.id, site: site.id })
					}
				}}
			/>
		</div>
	{:else}
		<div class="p-2 pt-0 bg-[var(--primo-color-black)]">
			<button class="create-page-btn" onclick={() => (creating_page = true)}>
				<Icon icon="akar-icons:plus" />
				<span>Create Page</span>
			</button>
		</div>
	{/if}
{/if}

<style lang="postcss">
	.create-page-btn {
		width: 100%;
		padding: 0.875rem 1.125rem;
		background: #1a1a1a;
		border-radius: var(--primo-border-radius);
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		align-items: center;
		transition: 0.1s;
		color: var(--color-gray-3);

		&:hover {
			border-color: var(--weave-primary-color);
			color: var(--weave-primary-color);
		}
	}
</style>
