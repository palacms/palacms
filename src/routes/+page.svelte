<script>
	import { goto } from '$app/navigation'
	import { checkSession } from '$lib/pocketbase/PocketBase'
	import { onMount } from 'svelte'

	onMount(async () => {
		if (await checkSession()) {
			await goto('/admin/site', { replaceState: true })
		} else {
			await goto('/admin/auth', { replaceState: true })
		}
	})
</script>
