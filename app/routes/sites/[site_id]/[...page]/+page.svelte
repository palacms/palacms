<script>
	import { compilers_registered } from '$lib/stores'
	import PrimoPage from '$lib/builder/views/editor/Page.svelte'
	import { page as pageState } from '$app/state'
	import { Sites, Pages } from '$lib/pocketbase/collections'

	const site_id = $derived(pageState.params.site_id)
	const page_slug = $derived(pageState.params.page)

	const site = $derived(Sites.one(site_id))
	const current_page = $derived(site && page_slug && Pages.list({ filter: `site = "${site.id}" && slug = "${page_slug}"` })?.[0])
</script>

{#if $compilers_registered && current_page}
	<PrimoPage page={current_page} />
{/if}
