<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import Item from './Item.svelte'
	import Button from '$lib/builder/ui/Button.svelte'
	import PageForm from './PageTypeForm.svelte'
	import { PageTypes, manager } from '$lib/pocketbase/collections'
	import { site_context } from '$lib/builder/stores/context'
	import { page as pageState } from '$app/state'

	// Get site from context (preferred) or fallback to hostname lookup
	const { value: site } = site_context.get()

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
				<Item {page_type} active={pageState.params.page_type === page_type.id} />
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
