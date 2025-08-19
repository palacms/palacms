<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { goto } from '$app/navigation'
	import Item from './Item.svelte'
	import Button from '$lib/builder/ui/Button.svelte'
	import PageForm from './PageTypeForm.svelte'
	import { page } from '$app/state'
	import { Sites, PageTypes, manager } from '$lib/pocketbase/collections'
	import type { PageType } from '$lib/common/models/PageType'
	import { getContext } from 'svelte'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	// Get site from context (preferred) or fallback to hostname lookup
	const site = getContext<ObjectOf<typeof Sites>>('site')

	async function create_page_type(new_page_type) {
		if (!site) return

		// Add the site ID to the page type
		const page_type_data = {
			...new_page_type,
			site: site.id
		}

		PageTypes.create(page_type_data)
		manager.commit()
	}

	let creating_page_type = $state(false)
</script>

<Dialog.Header title="Page Types" />
<main class="grid gap-2 p-2 bg-[var(--primo-color-black)]">
	<ul class="grid gap-2">
		{#each site?.page_types() || [] as page_type}
			<li>
				<Item {page_type} active={false} />
			</li>
		{/each}
		{#if creating_page_type}
			<li style="background: #1a1a1a;">
				<PageForm
					on:create={({ detail: new_page_type }) => {
						creating_page_type = false
						create_page_type(new_page_type)
					}}
				/>
			</li>
		{/if}
	</ul>
	<Button variants="secondary fullwidth" disabled={creating_page_type === true} onclick={() => (creating_page_type = true)} label="Create Page Type" icon="akar-icons:plus" />
</main>
