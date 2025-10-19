<script>
	import { goto } from '$app/navigation'
	import { check_session } from '$lib/pocketbase/user'
	import { onMount } from 'svelte'

	onMount(async () => {
		if (await check_session()) {
			await goto('/admin/site', { replaceState: true })
		} else {
			await goto('/admin/auth', { replaceState: true })
		}
	})
</script>
