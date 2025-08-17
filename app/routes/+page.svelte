<script>
	import { goto } from '$app/navigation'
	import { checkSession } from '$lib/pocketbase/PocketBase'
	import { onMount } from 'svelte'
	import axios from 'axios'

	onMount(async () => {
		// Check setup first to avoid going to auth when setup is needed
		try {
			const { data } = await axios.get('/_api/setup-status')
			if (!data.setupComplete) {
				await goto('/admin/setup', { replaceState: true })
				return
			}
		} catch (error) {
			// Continue to auth check
		}

		// Then check where to redirect based on auth
		if (await checkSession()) {
			await goto('/admin/site', { replaceState: true })
		} else {
			await goto('/admin/auth', { replaceState: true })
		}
	})
</script>
