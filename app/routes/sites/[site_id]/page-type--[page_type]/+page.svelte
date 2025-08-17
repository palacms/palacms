<script>
	import PageType from '$lib/builder/views/editor/PageType.svelte'
	import { compilers_registered } from '$lib/stores'
</script>

{#if $compilers_registered}
	<PageType />
{/if}
