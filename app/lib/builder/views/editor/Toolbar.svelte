<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { fade } from 'svelte/transition'
	import { find as _find } from 'lodash-es'
	import Icon from '@iconify/svelte'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { LayoutTemplate, Trash2, ChevronDown } from 'lucide-svelte'
	import ToolbarButton from './ToolbarButton.svelte'
	import Letter from '$lib/builder/ui/Letter.svelte'
	import { PalaButton } from '$lib/builder/components/buttons'
	import { mod_key_held } from '$lib/builder/stores/app/misc'
	import { onNavigate, goto } from '$app/navigation'
	import { active_users } from '$lib/builder/stores/app/misc'
	import { page as pageState } from '$app/state'
	import { Sites, PageTypes, SiteEntries, SiteFields, Pages, manager } from '$lib/pocketbase/collections'
	import hotkey_events from '$lib/builder/stores/app/hotkey_events'

	import SiteEditor from '$lib/builder/views/modal/SiteEditor/SiteEditor.svelte'
	import SitePages from '$lib/builder/views/modal/SitePages/SitePages.svelte'
	import PageTypeModal from '$lib/builder/views/modal/PageTypeModal/PageTypeModal.svelte'
	import Collaboration from '$lib/builder/views/modal/Collaboration.svelte'
	import Deploy from '$lib/components/Modals/Deploy/Deploy.svelte'
	import { usePublishSite } from '$lib/Publish.svelte'
	import type { Snippet } from 'svelte'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { current_user } from '$lib/pocketbase/user'

	let { children, site }: { children: Snippet; site?: ObjectOf<typeof Sites> } = $props()

	const host = $derived(pageState.url.host)
	const fallback_site = $derived(Sites.list({ filter: `host = "${host}"` })?.[0])
	const resolved_site = $derived(site || fallback_site)
	const page_slug = $derived(pageState.params.page || '')
	const page_type_id = $derived(pageState.params.page_type)
	const page = $derived(resolved_site && page_slug ? Pages.list({ filter: `site = "${resolved_site.id}" && slug = "${page_slug}"` })?.[0] : undefined)
	const page_type = $derived(page_type_id && PageTypes.one(page_type_id))
	const page_page_type = $derived(page && PageTypes.one(page.page_type))

	const publish = $derived(usePublishSite(resolved_site?.id))

	let going_up = $state(false)
	let going_down = $state(false)

	// Get root-level pages for navigation (homepage + direct children)
	const home_page = $derived(resolved_site?.homepage())
	const child_pages = $derived(home_page?.children() ?? [])
	const root_pages = $derived(home_page ? [home_page, ...child_pages] : [])
	const current_page_index = $derived(root_pages.findIndex((p) => p.id === page?.id))
	const can_navigate_up = $derived(current_page_index > 0)
	const can_navigate_down = $derived(current_page_index < root_pages.length - 1 && current_page_index !== -1)

	// Navigation functions
	function navigate_up() {
		if (can_navigate_up) {
			const prev_page = root_pages[current_page_index - 1]
			const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${resolved_site?.id}` : '/admin/site'
			goto(`${base_path}/${prev_page.slug}`)
		}
	}

	function navigate_down() {
		if (can_navigate_down) {
			const next_page = root_pages[current_page_index + 1]
			const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${resolved_site?.id}` : '/admin/site'
			goto(`${base_path}/${next_page.slug}`)
		}
	}

	let customAnchor = $state<HTMLElement>(null!)

	let editing_site = $state(false)
	let site_has_unsaved_changes = $state(false)
	let editing_pages = $state(false)
	let editing_page_types = $state(false)
	let editing_collaborators = $state(false)
	let publishing = $state(false)
	let publish_stage = $state('INITIAL')

	// Close all dialogs on navigation
	onNavigate(() => {
		editing_pages = false
		editing_page_types = false
		publishing = false
		publish_stage = 'INITIAL'
	})

	// Hotkey event listeners
	hotkey_events.on('up', () => {
		if (can_navigate_up) {
			going_up = true
			navigate_up()
			setTimeout(() => (going_up = false), 150)
		}
	})

	hotkey_events.on('down', () => {
		if (can_navigate_down) {
			going_down = true
			navigate_down()
			setTimeout(() => (going_down = false), 150)
		}
	})
</script>

<Dialog.Root
	bind:open={editing_site}
	onOpenChange={(open) => {
		if (!open) {
			if (site_has_unsaved_changes) {
				if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
					editing_site = true
					return
				}
			}
			manager.discard()
		}
	}}
>
	<Dialog.Content class="z-[999] max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4">
		<SiteEditor onClose={() => (editing_site = false)} bind:has_unsaved_changes={site_has_unsaved_changes} />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_pages}>
	<Dialog.Content class="z-[999] max-w-[1200px] h-full max-h-[100vh] flex flex-col p-4">
		<SitePages />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_page_types}>
	<Dialog.Content class="z-[999] max-w-[1200px] h-full max-h-[100vh] flex flex-col p-4">
		<PageTypeModal />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_collaborators}>
	<Dialog.Content class="z-[999] max-w-[600px] flex flex-col p-4">
		<Collaboration {site} />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={publishing}>
	<Dialog.Content class="z-[999] max-w-[500px] flex flex-col p-0">
		<Deploy
			bind:stage={publish_stage}
			publish_fn={publish.publish}
			loading={publish.status !== 'standby'}
			site_host={resolved_site?.host}
			onClose={() => {
				publishing = false
				publish_stage = 'INITIAL'
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

<nav aria-label="toolbar" id="primo-toolbar" class="primo-reset">
	<div class="menu-container">
		<div class="left">
			{#if $current_user?.serverRole}
				<PalaButton />
			{/if}
			<div class="button-group">
				<div class="flex rounded" style="border: 1px solid #222">
					<!-- <ToolbarButton label="Site" icon="gg:website" on:click={() => modal.show('SITE_EDITOR', {}, { showSwitch: true, disabledBgClose: true })} /> -->
					<ToolbarButton label="Site" icon="gg:website" on:click={() => (editing_site = true)} />
				</div>
			</div>
			<div class="button-group">
				{#if $mod_key_held}
					<div class="page-hotkeys">
						<div style:color={going_up ? 'var(--weave-primary-color)' : 'inherit'} style:opacity={can_navigate_up ? 1 : 0.3}>&#8984; ↑</div>
						<div style:color={going_down ? 'var(--weave-primary-color)' : 'inherit'} style:opacity={can_navigate_down ? 1 : 0.3}>&#8984; ↓</div>
					</div>
				{:else}
					<div class="flex rounded" style="border: 1px solid #222" bind:this={customAnchor}>
						<ToolbarButton label="Pages" icon="iconoir:multiple-pages" on:click={() => (editing_pages = true)} />
						{#if $current_user?.siteRole === 'developer' || $current_user?.serverRole === 'developer'}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button {...props} class="hover:bg-[var(--primo-color-codeblack)]" style="border-left: 1px solid #222">
											<ChevronDown class="h-4" />
											<span class="sr-only">More</span>
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content side="bottom" class="z-[999]" align="start" sideOffset={4} {customAnchor}>
									<DropdownMenu.Item onclick={() => (editing_page_types = true)} class="text-xs cursor-pointer">
										<LayoutTemplate style="width: .75rem" />
										<span>Page Types</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		<div class="site-name">
			<span class="site">{resolved_site?.name}</span>
			{#if page_type}
				<span class="separator">/</span>
				<div class="page-type" style:background={page_type.color}>
					<Icon icon={page_type.icon} />
					<span>{page_type.name}</span>
				</div>
			{:else if page}
				<span class="separator">/</span>
				<span class="page">{page.name}</span>
				{#if page_page_type}
					{#if $current_user?.siteRole === 'developer'}
						{@const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${resolved_site?.id}` : '/admin/site'}
						<a class="page-type-badge" style="background-color: {page_page_type.color};" href="{base_path}/page-type--{page_page_type.id}">
							<Icon icon={page_page_type.icon} />
						</a>
					{:else}
						<span class="page-type-badge" style="background-color: {page_page_type.color};">
							<Icon icon={page_page_type.icon} />
						</span>
					{/if}
				{/if}
			{:else if page_slug}
				<span class="separator">/</span>
				<span class="page">{page_slug}</span>
			{/if}
		</div>
		<div class="right">
			{#if $active_users.length > 0}
				<div class="active-editors flex gap-1">
					{#each $active_users as user}
						<div class="editor" transition:fade={{ duration: 200 }}>
							<Letter letter={user.email.slice(0, 1)} />
						</div>
					{/each}
				</div>
			{/if}
			<!-- {#if !$timeline.first}
				<ToolbarButton id="undo" title="Undo" icon="material-symbols:undo" style="border: 0; font-size: 1.5rem;" on:click={undo_change} />
			{/if}
			{#if !$timeline.last}
				<ToolbarButton id="redo" title="Redo" icon="material-symbols:redo" style="border: 0; font-size: 1.5rem;" on:click={redo_change} />
			{/if} -->
			{#if $current_user?.serverRole}
				<ToolbarButton icon="clarity:users-solid" on:click={() => (editing_collaborators = true)} />
			{/if}
			{@render children?.()}
			<!-- <LocaleSelector /> -->
			<ToolbarButton type="primo" icon="entypo:publish" label="Publish" loading={publish.status !== 'standby'} on:click={() => (publishing = true)} />
		</div>
	</div>
</nav>

<style lang="postcss">
	#primo-toolbar {
		z-index: 99;
		border-bottom: 1px solid var(--color-gray-8);
	}

	.left {
		/* width: 100%; */
		display: flex;
		justify-content: flex-start;
		gap: 0.25rem;
	}

	.dropdown {
		display: flex;
		position: relative;
	}

	.left .button-group {
		display: flex;
		flex-direction: row;
	}

	.site-name {
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		place-content: center;

		.site {
			color: #b6b6b6;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.separator {
			color: #b6b6b6;
			margin: 0 0.25rem;
		}
		.page {
			color: white;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.page-type {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			color: white;
			border-radius: 1rem;
			padding: 2px 6px;
		}
		.page-type-badge {
			padding: 5px;
			border-radius: 1rem;
			aspect-ratio: 1;
			font-size: 0.75rem;
			display: flex;
			justify-content: center;
			align-items: center;
			color: white;
			margin-left: 0.25rem;
		}

		@media (max-width: 670px) {
			display: none;
		}
	}

	.menu-container {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		margin: 0 auto;
		/* background: #121212; */
		/* background: var(--color-gray-9); */
		padding: 6px 0.5rem;
		/* position: fixed;
		left: 0;
		right: 0;
		top: 0;
		z-index: 9999; */
		backdrop-filter: blur(4px);
		background: rgba(10, 10, 10, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);

		@media (max-width: 670px) {
			grid-template-columns: 1fr 1fr;
		}
	}

	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		place-content: flex-end;
	}

	.button-group {
		height: 100%;
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
	}

	.page-hotkeys {
		font-size: 0.75rem;
		padding-inline: 9px;
		display: flex;
		gap: 4px;
		justify-content: space-around;
		border: 1px solid var(--color-gray-8);
		color: white;
		height: 100%;
		align-items: center;
		border-radius: var(--primo-border-radius);
	}
</style>
