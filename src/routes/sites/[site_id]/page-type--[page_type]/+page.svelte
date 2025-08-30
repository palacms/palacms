<script>
	import { page } from '$app/state'
	import PageType from '$lib/builder/views/editor/PageType.svelte'
	import { PageTypes } from '$lib/pocketbase/collections'
	import { compilers_registered } from '$lib/stores'

	const page_type_id = $derived(page.params.page_type)
	const page_type = $derived(page_type_id && PageTypes.one(page_type_id))
</script>

{#if $compilers_registered && page_type}
	<PageType {page_type} />
{/if}
