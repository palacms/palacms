<script>
	import Pala from '$lib/builder/Pala.svelte'
	import { checkSession } from '$lib/pocketbase/PocketBase'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Sites } from '$lib/pocketbase/collections'
	import { current_user, set_current_user } from '$lib/pocketbase/user'

	onMount(async () => {
		if (!(await checkSession())) {
			await goto('/admin/auth')
		}
	})

	let { children } = $props()

	const site_id = $derived(page.params.site_id)
	const site = $derived(site_id && Sites.one(site_id))

	$effect(() => set_current_user(site || undefined))
</script>

{#if site && $current_user && !$current_user?.siteRole === null}
	<div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white;">Forbidden</div>
{:else if site}
	<Pala {site}>
		{@render children?.()}
	</Pala>
{:else}
	<div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white;">Loading...</div>
{/if}
