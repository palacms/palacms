<script lang="ts">
	import { compilers_registered } from '$lib/stores'
	import PalaPage from '$lib/builder/views/editor/Page.svelte'
	import { page as pageState } from '$app/state'
	import { Sites } from '$lib/pocketbase/collections'

	const host = $derived(pageState.url.host)
	const site = $derived(Sites.list({ filter: `host = "${host}"` })?.[0])
	const page = $derived(site?.homepage())
</script>

{#if $compilers_registered && page}
	<PalaPage {page} />
{:else}
	<div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white;">Loading...</div>
{/if}
