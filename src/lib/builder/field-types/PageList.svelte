<script>
	import { PageTypes } from '$lib/pocketbase/collections'

	let { field, value } = $props()

	const selected_page_type = $derived(PageTypes.one(field.config.page_type))
</script>

{#if selected_page_type}
	<div>A list of {selected_page_type.name} pages</div>
{:else}
	<div>No page connected</div>
{/if}

<style lang="postcss">
	div {
		font-size: 0.875rem;
	}
</style>
