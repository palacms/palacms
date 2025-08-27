<script lang="ts">
	import { compilers_registered } from '$lib/stores'
	import PalaPage from '$lib/builder/views/editor/Page.svelte'
	import { page as pageState } from '$app/state'
	import { Sites, Pages } from '$lib/pocketbase/collections'

	const host = $derived(pageState.url.host)
	const site = $derived(Sites.list({ filter: `host = "${host}"` })?.[0])
	const slug = $derived(pageState.params.page)
	const page = $derived(site && slug && Pages.list({ filter: `site = "${site.id}" && slug = "${slug}"` })?.[0])
</script>

{#if $compilers_registered && page}
	<PalaPage {page} />
{/if}
