<script>
	import * as Sidebar from '$lib/components/ui/sidebar'
	import AppSidebar from '$lib/components/app-sidebar.svelte'
	import { Globe, LayoutTemplate, Store, Library, Cuboid } from 'lucide-svelte'
	import { page } from '$app/state'
	import { checkSession } from '$lib/pocketbase/PocketBase'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { current_user, set_current_user } from '$lib/pocketbase/user'

	onMount(async () => {
		if (!(await checkSession())) {
			await goto('/admin/auth')
		}
	})

	let { children } = $props()

	const sidebar_menu = $derived.by(() => {
		const pathname = page.url.pathname
		const path = pathname.split('/').slice(0, 4).join('/')
		return {
			'/admin/dashboard/sites': {
				title: 'Sites',
				icon: Globe
			},
			'/admin/dashboard/library': {
				title: 'Block Library',
				icon: Library
			},
			'/admin/dashboard/marketplace': {
				title: 'Marketplace',
				icon: Store,
				buttons: [
					{
						icon: LayoutTemplate,
						label: 'Starters',
						url: '/admin/dashboard/marketplace/starters',
						isActive: pathname === '/admin/dashboard/marketplace/starters'
					},
					{
						icon: Cuboid,
						label: 'Blocks',
						url: '/admin/dashboard/marketplace/blocks',
						isActive: pathname === '/admin/dashboard/marketplace/blocks'
					}
				]
			}
		}[path]
	})

	$effect(() => set_current_user())
</script>

{#if !$current_user?.serverRole}
	<div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white;">Forbidden</div>
{:else}
	<Sidebar.Provider>
		<AppSidebar {sidebar_menu} />
		<Sidebar.Inset>
			{@render children?.()}
		</Sidebar.Inset>
	</Sidebar.Provider>
{/if}
