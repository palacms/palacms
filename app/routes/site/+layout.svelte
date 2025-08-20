<script>
	import Pala from '$lib/builder/Pala.svelte'
	import { checkSession, self } from '$lib/pocketbase/PocketBase'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { manager, Sites } from '$lib/pocketbase/collections'
	import CreateSite from '$lib/components/CreateSite.svelte'
	import { current_user, set_current_user } from '$lib/pocketbase/user'
	import { Loader } from 'lucide-svelte'

	onMount(async () => {
		if (!(await checkSession())) {
			await goto('/admin/auth')
		}
	})

	let { children } = $props()

	const host = $derived(page.url.host)
	const sites = $derived(Sites.list({ filter: `host = "${host}"` }))
	const site = $derived(sites?.[0])

	let creating_site = $state(false)
	$effect(() => {
		if (!creating_site && sites?.length === 0 && self.authStore.isValid) {
			creating_site = true
		}
	})

	$effect(() => set_current_user(site || undefined))
</script>

{#if creating_site}
	<CreateSite
		oncreated={() => {
			manager.lists.clear()
			creating_site = false
		}}
	/>
{:else if site}
	<Pala {site}>
		{@render children?.()}
	</Pala>
{:else}
	<div class="placeholder">
		<Loader />
	</div>
{/if}

<style>
	.placeholder {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		color: white;
	}
</style>
