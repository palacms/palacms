<script lang="ts">
	import Item from './Item.svelte'
	import Icon from '@iconify/svelte'
	import { onMount } from 'svelte'
	import { get, set } from 'idb-keyval'
	import { content_editable, validate_url } from '$lib/builder/utilities'
	import PageForm from './PageForm.svelte'
	import MenuPopup from '$lib/builder/ui/Dropdown.svelte'
	import { page as pageState } from '$app/state'
	import { manager, Pages, PageTypes, Sites } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { site_context } from '$lib/builder/stores/context'
	import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import type { Page } from '$lib/common/models/Page'

	let editing_page = $state(false)

	/** @type {Props} */
	let {
		parent,
		page,
		active,
		oncreate,
		page_slug,
		hover_position = $bindable(null)
	}: {
		parent?: ObjectOf<typeof Pages>
		page: ObjectOf<typeof Pages>
		active: boolean
		oncreate: (new_page: Omit<Page, 'id' | 'index'>) => Promise<void>
		page_slug: string
		hover_position?: string | null
	} = $props()

	// Get site from context (preferred) or fallback to hostname lookup
	const site = site_context.get()
	const full_url = $derived(() => {
		const base_path = pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
		return `${base_path}/${page.slug}`
	})
	const allPages = $derived(site?.pages() ?? [])
	const page_type = $derived(PageTypes.one(page.page_type))
	const home_page = $derived(site.homepage())

	let showing_children = $state(false)
	let children = $derived(page.children() ?? [])
	let has_children = $derived(children.length > 0 && page.slug !== '')

	get(`page-list-toggle--${page.id}`).then((toggled) => {
		if (toggled !== undefined) showing_children = toggled
	})
	$effect(() => {
		set(`page-list-toggle--${page.id}`, showing_children)
	})

	let creating_page = $state(false)
	let new_page_url = $state('')
	$effect(() => {
		new_page_url = validate_url(new_page_url)
	})

	let drag_handle_element = $state()
	let element = $state()
	onMount(async () => {
		draggable({
			element,
			dragHandle: drag_handle_element,
			getInitialData: () => ({ page }),
			onDragStart: () => {
				is_dragging = true
			},
			onDrop: () => {
				is_dragging = false
			}
		})
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ page },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDrag({ self, source }) {
				const edge = extractClosestEdge(self.data)
				if (edge === 'bottom') {
					// Set hover position to show indicator below this item
					// Special handling for the last item in the list
					const siblings = allPages.filter(p => p.parent === page.parent).sort((a, b) => a.index - b.index)
					const isLastItem = siblings[siblings.length - 1]?.id === page.id
					
					if (page.index === 0) {
						hover_position = 'home-bottom'
					} else if (isLastItem && page.parent === home_page?.id) {
						// This is the last child page - show the end indicator
						hover_position = `${page.id}-bottom`
					} else {
						hover_position = `${page.id}-bottom`
					}
				} else if (edge === 'top') {
					// For top edge, we want to show the indicator above this item
					// which is the bottom of the previous item
					if (page.index === 0) {
						hover_position = null // Can't drop above home
					} else if (page.index === 1) {
						hover_position = 'home-bottom'
					} else {
						// Find the previous sibling
						const siblings = allPages.filter(p => p.parent === page.parent).sort((a, b) => a.index - b.index)
						const prevIndex = siblings.findIndex(p => p.id === page.id) - 1
						if (prevIndex >= 0) {
							hover_position = `${siblings[prevIndex].id}-bottom`
						}
					}
				}
			},
			onDragLeave() {
				hover_position = null
			},
			onDrop({ self, source }) {
				const page_dragged_over = self.data.page
				const page_being_dragged = source.data.page
				const closestEdgeOfTarget = extractClosestEdge(self.data)

				// Don't allow dragging onto itself
				if (page_dragged_over.id === page_being_dragged.id) {
					hover_position = null
					return
				}

				// Don't allow placing above home page
				if (closestEdgeOfTarget === 'top' && page_dragged_over.index === 0) {
					hover_position = null
					return
				}

				// Get all siblings (pages with same parent)
				const siblings = allPages.filter((p) => p.parent === page_being_dragged.parent).sort((a, b) => a.index - b.index)

				const old_index = page_being_dragged.index
				let target_index

				if (closestEdgeOfTarget === 'top') {
					target_index = page_dragged_over.index
				} else if (closestEdgeOfTarget === 'bottom') {
					target_index = page_dragged_over.index + 1
				}

				// Adjust target index if we're moving from before to after in the list
				let final_index = target_index
				if (old_index < target_index) {
					final_index = target_index - 1
				}

				// Don't do anything if position hasn't changed
				if (old_index === final_index) {
					hover_position = null
					return
				}

				// Reindex all affected siblings
				const updates = []
				for (let i = 0; i < siblings.length; i++) {
					const sibling = siblings[i]
					let new_index = sibling.index
					
					if (sibling.id === page_being_dragged.id) {
						new_index = final_index
					} else if (old_index < final_index) {
						// Moving item down - shift others up
						if (sibling.index > old_index && sibling.index <= final_index) {
							new_index = sibling.index - 1
						}
					} else {
						// Moving item up - shift others down
						if (sibling.index >= final_index && sibling.index < old_index) {
							new_index = sibling.index + 1
						}
					}
					
					if (new_index !== sibling.index) {
						Pages.update(sibling.id, { index: new_index })
					}
				}

				manager.commit()
				hover_position = null
			}
		})
	})

	let is_dragging = $state(false)
</script>

<div class="Item" bind:this={element} class:contains-child={parent} class:dragging={is_dragging}>
	<div class="page-item-container" class:active class:expanded={showing_children && has_children}>
		<div class="left">
			{#if editing_page}
				<div class="details">
					<div
						class="name"
						use:content_editable={{
							autofocus: true,
							on_change: (val) => (page.name = val),
							on_submit: () => (editing_page = false)
						}}
					>
						{page.name}
					</div>
					{#if page.slug !== ''}
						<div class="url">
							<span>/</span>
							<div
								class="url"
								use:content_editable={{
									on_change: (val) => {
										page.slug = validate_url(val)
									},
									on_submit: () => (editing_page = false)
								}}
							>
								{page.slug}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="details">
					<span class="icon" style:background={page_type?.color}>
						<Icon icon={page_type?.icon} />
					</span>
					<a class:active href={full_url()} onclick={() => {}} class="name">{page.name}</a>
					<span class="url">/{page.slug}</span>
				</div>
			{/if}
			{#if has_children}
				<button class="toggle" class:active={showing_children} onclick={() => (showing_children = !showing_children)} aria-label="Toggle child pages">
					<Icon icon="mdi:chevron-down" />
				</button>
			{/if}
		</div>
		<div class="options">
			<!-- TODO: enable reordering for child pages -->
			{#if !parent}
				<button class="drag-handle" bind:this={drag_handle_element} style:visibility={page.slug === '' ? 'hidden' : 'visible'}>
					<Icon icon="material-symbols:drag-handle" />
				</button>
			{/if}
			<MenuPopup
				icon="carbon:overflow-menu-vertical"
				options={[
					...(!creating_page
						? [
								{
									label: `Create Child Page`,
									icon: 'akar-icons:plus',
									on_click: () => {
										creating_page = true
									}
								}
							]
						: []),
					{
						label: 'Change Name',
						icon: 'clarity:edit-solid',
						on_click: () => {
							editing_page = !editing_page
						}
					},
					...(!!page.parent
						? [
								{
									label: 'Delete',
									icon: 'ic:outline-delete',
									on_click: async () => {
										const parent_id = page.parent
										Pages.delete(page.id)

										// Reindex remaining sibling pages
										const sibling_pages = allPages.filter((p) => p.parent === parent_id).sort((a, b) => a.index - b.index)

										sibling_pages.forEach((sibling_page, i) => {
											const index = parent_id === home_page?.id ? i + 1 : i
											Pages.update(sibling_page.id, { index })
										})

										await manager.commit()
									}
								}
							]
						: [])
				]}
			/>
		</div>
	</div>

	{#if showing_children && has_children}
		<ul class="page-list child">
			{#each children as subpage}
				<Item parent={page} page={subpage} active={subpage.slug === page_slug} {page_slug} on:delete on:create />
			{/each}
		</ul>
	{/if}

	{#if creating_page}
		<div style="border-left: 0.5rem solid #111;">
			<PageForm
				parent={page}
				oncreate={async (new_page: Omit<Page, 'id' | 'parent' | 'site' | 'index'>) => {
					creating_page = false
					showing_children = true
					const url_taken = allPages.some((page) => page?.slug === new_page.slug)
					if (url_taken) {
						alert(`That URL is already in use`)
					} else {
						await oncreate({ ...new_page, parent: page.id, site: site.id })
					}
				}}
			/>
		</div>
	{:else if showing_children && has_children}
		<button class="create-page" onclick={() => (creating_page = true)}>
			<Icon icon="akar-icons:plus" />
			<span>Create Child Page</span>
		</button>
	{/if}
</div>

<style lang="postcss">

	button.create-page {
		padding: 0.5rem;
		background: var(--primo-color-codeblack);
		margin-left: 0.5rem;
		width: calc(100% - 0.5rem);
		font-size: 0.75rem;
		border-bottom-left-radius: var(--primo-border-radius);
		border-bottom-right-radius: var(--primo-border-radius);
		display: flex;
		justify-content: center;
		gap: 0.25rem;
		align-items: center;
		transition: 0.1s;

		&:hover {
			box-shadow: var(--primo-ring-thin);
		}
	}
	.drag-handle {
		cursor: grab;
	}
	.Item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		transition: transform 0.2s ease, opacity 0.2s ease;
		/* padding-bottom: 0.5rem; */
		
		&.dragging {
			opacity: 0.5;
			transform: scale(0.98);
		}

		&.contains-child {
			.page-item-container {
				padding-block: 0.5rem;
				border-radius: 0;
			}

			.details {
				gap: 0.75rem;
			}

			.icon {
				font-size: 10px !important;
				padding: 4px !important;
				aspect-ratio: 1;
				align-self: center;
			}

			hr {
				border-width: 1px !important;
				border-color: #1a1a1a !important;
			}
		}
	}
	.page-item-container {
		display: flex;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		border-bottom-left-radius: 0.25rem;
		background: #1a1a1a;
		border-radius: var(--primo-border-radius);
		&.expanded {
			border-bottom-right-radius: 0;
			border-bottom: 1px solid var(--color-gray-9);
		}

		&.active {
			/* background: #222; */
			border-bottom-right-radius: 0;
			/* outline: 1px solid var(--weave-primary-color); */

			a {
				color: var(--weave-primary-color);
			}
		}

		.left {
			display: flex;
			align-items: center;
			gap: 0.5rem;

			.details {
				font-weight: 400;
				line-height: 1.5rem;
				display: grid;
				grid-template-columns: auto auto 1fr;
				place-items: center;
				gap: 1rem;
				color: var(--color-gray-1);

				.icon {
					font-size: 0.75rem;
					padding: 6px;
					border-radius: 1rem;
					display: flex;
					justify-content: center;
					align-items: center;
				}

				a.name {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					border-bottom: 1px solid transparent;
					margin-bottom: -1px;
					transition: 0.1s;
					&:hover {
						border-color: white;
					}
				}

				.url {
					display: flex;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					font-weight: 400;
					color: var(--color-gray-5);
					max-width: 10rem;
					display: inline-block; /* This is key for spans */
					max-width: 200px; /* Using max-width is often better for responsive designs */
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				div.name,
				div.url {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					width: 100%;
					color: var(--weave-primary-color);

					span {
						color: var(--color-gray-5);
					}

					&:focus {
						outline: none;
					}
				}
			}

			.toggle {
				padding: 0 0.5rem;
				transition: 0.1s color;
				font-size: 1.5rem;

				&:hover {
					color: var(--weave-primary-color);
				}

				&.active {
					transform: scaleY(-1);
				}
			}
		}

		.options {
			display: flex;
			gap: 0.75rem;
		}
	}

	ul.page-list {
		margin: 0 1rem 1rem 1rem;
		/* background: #323334; */
		border-radius: var(--primo-border-radius);

		&.child {
			font-size: 0.875rem;
			margin: 0;
			/* border-top: 1px solid #222; */
			/* margin-left: 1rem; */
			border-top-right-radius: 0;
			border-top-left-radius: 0;
		}

		&.child:not(.entry) {
			margin-left: 0.5rem;
		}
	}
</style>
