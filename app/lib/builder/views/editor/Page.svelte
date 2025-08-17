<script lang="ts">
	import * as _ from 'lodash-es'
	import { tick } from 'svelte'
	import { flip } from 'svelte/animate'
	import UI from '$lib/builder/ui'
	import * as Dialog from '$lib/components/ui/dialog'
	import SectionEditor from '$lib/builder/views/modal/SectionEditor/SectionEditor.svelte'
	import ComponentNode from './Layout/ComponentNode.svelte'
	import BlockToolbar from './Layout/BlockToolbar.svelte'
	import LockedOverlay from './Layout/LockedOverlay.svelte'
	import DropIndicator from './Layout/DropIndicator.svelte'
	import { locale, locked_blocks, page_loaded, dragging_symbol } from '$lib/builder/stores/app/misc'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { beforeNavigate } from '$app/navigation'
	import { Pages, Sites, SiteSymbols, PageSections, PageTypes, PageSectionEntries, manager } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import hotkey_events from '$lib/builder/stores/app/hotkey_events'

	let { page }: { page: ObjectOf<typeof Pages> } = $props()

	const site = $derived(Sites.one(page.site))
	const page_type = $derived(page.page_type ? PageTypes.one(page.page_type) : null)
	const page_type_sections = $derived(page_type?.sections() ?? [])

	// Group page type sections by zone
	const header_sections = $derived(page_type_sections.filter((s) => s.zone === 'header'))
	const footer_sections = $derived(page_type_sections.filter((s) => s.zone === 'footer'))
	const page_type_body_sections = $derived(page_type_sections.filter((s) => s.zone === 'body'))

	const sections = $derived(page.sections() ?? [])

	// Check if page type is static (no symbols toggled - sections can't be added/removed/reordered)
	const is_static_page_type = $derived(page_type ? page_type.symbols()?.length === 0 : false)

	// Fade in page when all components mounted
	let page_mounted = $state(false)

	// detect when all sections are mounted to fade in page
	let sections_mounted = $state(0)

	beforeNavigate(() => {
		page_mounted = false
		sections_mounted = 0
	})

	async function lock_block(block_id) {
		// TODO: Implement
	}

	function unlock_block() {
		// TODO: Implement
	}

	async function repair_section_indices() {
		// Just use the current order of sections and assign consecutive indices
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].index !== i) {
				PageSections.update(sections[i].id, { index: i })
			}
		}
	}

	async function add_section_to_page({ symbol, position }) {
		// Check if indices need repair
		const has_incorrect_indices = sections.some((section, i) => section.index !== i)
		if (has_incorrect_indices) {
			await repair_section_indices()
		}

		// Adjust indices of existing sections that come after the insertion position
		const existing_sections = sections.filter((section) => section.index >= position)

		// Create new section with correct index
		const new_section = PageSections.create({
			page: page.id,
			symbol: symbol.id,
			index: position
		})

		// Copy only root-level symbol entries to the new section instance
		// Nested entries will be created on-demand by FieldsContent
		const rootEntries = symbol.entries()?.filter((e) => !e.parent) ?? []
		for (const entry of rootEntries) {
			PageSectionEntries.create({
				section: new_section.id,
				field: entry.field,
				locale: entry.locale,
				value: entry.value,
				index: entry.index
			})
		}

		for (const section of existing_sections) {
			PageSections.update(section.id, { index: section.index + 1 })
		}

		await manager.commit()

		return new_section.id
	}

	async function remove_section_from_page(section_id) {
		const section_to_delete = sections.find((s) => s.id === section_id)
		if (!section_to_delete) return

		// Adjust indices of remaining sections that come after the deleted section
		const sections_to_update = sections.filter((section) => section.index > section_to_delete.index)
		for (const section of sections_to_update) {
			PageSections.update(section.id, { index: section.index - 1 })
		}

		// Delete the section
		PageSections.delete(section_id)
		await manager.commit()
	}

	let page_el = $state()
	let hovered_block_el = $state()

	////////////////////////////
	// BLOCK TOOLBAR ///////////
	////////////////////////////

	let block_toolbar_element = $state()
	let showing_block_toolbar = $state(false)

	// Add this state variable to track if we're hovering over the toolbar
	let hovering_toolbar = $state(false)

	async function show_block_toolbar() {
		// Clear any pending hide timeout
		if (hide_toolbar_timeout) {
			clearTimeout(hide_toolbar_timeout)
			hide_toolbar_timeout = null
		}

		if (!showing_block_toolbar) {
			showing_block_toolbar = true
			await tick()
			position_block_toolbar()
			page_el.addEventListener('scroll', position_block_toolbar)
		} else {
			// Already showing, just reposition
			position_block_toolbar()
		}
	}

	async function position_block_toolbar() {
		if (!hovered_block_el || !block_toolbar_element) return

		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const toolbar_height = 44

		// Keep toolbar within viewport bounds
		const toolbar_top = Math.max(toolbar_height, Math.min(top, window.innerHeight - toolbar_height))
		const toolbar_bottom = Math.max(0, window.innerHeight - bottom)

		block_toolbar_element.style.position = 'fixed'
		block_toolbar_element.style.top = `${toolbar_top}px`
		block_toolbar_element.style.bottom = `${toolbar_bottom}px`
		block_toolbar_element.style.left = `${left}px`
		block_toolbar_element.style.right = `${window.innerWidth - right}px`
	}

	let hide_toolbar_timeout = null

	async function hide_block_toolbar() {
		// Clear any existing timeout
		if (hide_toolbar_timeout) {
			clearTimeout(hide_toolbar_timeout)
		}
		// Increase delay to prevent toolbar flicker when moving between sections
		hide_toolbar_timeout = setTimeout(() => {
			if (!hovering_toolbar) {
				showing_block_toolbar = false
				page_el.removeEventListener('scroll', position_block_toolbar)
			}
		}, 300)
	}

	////////////////////////////
	// DROP INDICATOR //////////
	////////////////////////////

	let drop_indicator_element = $state()
	let showing_drop_indicator = $state(false)

	async function show_drop_indicator() {
		if (!showing_drop_indicator) {
			showing_drop_indicator = true
			await tick()
			// Reset display style when showing
			if (drop_indicator_element) {
				drop_indicator_element.style.display = ''
			}
			page_el.addEventListener('scroll', position_drop_indicator)
		}
	}

	async function position_drop_indicator() {
		if (!hovered_block_el || !drop_indicator_element) return

		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()

		// Position the line at the appropriate edge
		drop_indicator_element.style.left = `${left}px`
		drop_indicator_element.style.width = `${right - left}px`

		if (dragging.position === 'top') {
			// Show line at the top edge of the section
			drop_indicator_element.style.top = `${top - 2}px`
			drop_indicator_element.style.bottom = 'initial'
		} else if (dragging.position === 'bottom') {
			// Show line at the bottom edge of the section
			drop_indicator_element.style.top = `${bottom - 2}px`
			drop_indicator_element.style.bottom = 'initial'
		}
	}

	function hide_drop_indicator() {
		showing_drop_indicator = false
		if (page_el) {
			page_el.removeEventListener('scroll', position_drop_indicator)
		}
		// Force hide the element immediately
		if (drop_indicator_element) {
			drop_indicator_element.style.display = 'none'
		}
	}

	////////////////////////////

	let editing_section_tab = $state('code')
	async function edit_section(tab) {
		if (!hovered_section) return

		lock_block(hovered_section.id)
		editing_section = true
		editing_section_tab = tab
	}

	// Listen for Command-E hotkey to open section editor
	hotkey_events.on('e', () => {
		if (hovered_section && showing_block_toolbar) {
			lock_block(hovered_section.id)
			editing_section = true
			editing_section_tab = 'code'
		}
	})

	let moving = $state(false) // workaround to prevent block toolbar from showing when moving blocks

	// Handle unsaved changes for section editor
	let section_has_unsaved_changes = $state(false)

	let dragging = $state({
		id: null,
		position: null
	})
	function reset_drag() {
		// Clear any pending drag leave timeout
		if (drag_leave_timeout) {
			clearTimeout(drag_leave_timeout)
			drag_leave_timeout = null
		}

		dragging = {
			id: null,
			position: null
		}
		dragging_over_section = false
		hide_drop_indicator()
	}

	let dragging_over_section = $state(false)
	let drag_leave_timeout = null

	function drag_fallback(element) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{},
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			async onDrag({ self, source }) {
				// Clear any pending drag leave timeout since we're still dragging
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

				if (dragging_over_section) return // prevent double-adding block

				// When page is empty, use the empty state div as the drop target
				if (sections.length === 0) {
					const empty_state_el = page_el.querySelector('.empty-state')
					if (empty_state_el) {
						hovered_block_el = empty_state_el
					} else {
						hovered_block_el = page_el
					}

					if (!showing_drop_indicator) {
						await show_drop_indicator()
					}
					position_drop_indicator()
					dragging = {
						id: 'empty-page',
						position: 'bottom'
					}
					return
				}

				const last_section_id = sections[sections.length - 1]?.id ?? page_type_body_sections[page_type_body_sections.length - 1]?.id
				if (!last_section_id) return
				hovered_block_el = page_el.querySelector(`[data-section="${last_section_id}"]`)

				if (!showing_drop_indicator) {
					await show_drop_indicator()
				}
				position_drop_indicator()
				if (dragging.id !== last_section_id || dragging.position !== extractClosestEdge(self.data)) {
					dragging = {
						id: last_section_id,
						position: extractClosestEdge(self.data)
					}
				}
			},
			onDragLeave({ source }) {
				// Use a timeout to avoid hiding the indicator when briefly leaving the area
				// but still dragging over a valid drop target
				drag_leave_timeout = setTimeout(() => {
					reset_drag()
				}, 100)
			},
			async onDrop({ source }) {
				// Immediately hide drop indicator
				hide_drop_indicator()

				// Clear any pending drag leave timeout
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

				if (dragging_over_section) {
					return // prevent double-adding block
				}
				const block_being_dragged = source.data.block
				const new_section_id = await add_section_to_page({
					symbol: block_being_dragged,
					position: sections.length
				})
				// const new_section_el = page_el.querySelector(`[data-section="${new_section_id}"]`)
				// new_section_el.scrollIntoView({
				// 	behavior: 'smooth',
				// 	block: 'center',
				// 	inline: 'center'
				// })
				reset_drag()
			}
		})
	}

	function drag_item(element, section) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ section },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			async onDrag({ self, source }) {
				// Clear any pending drag leave timeout since we're still dragging
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

				hovered_block_el = self.element
				if (!showing_drop_indicator) {
					await show_drop_indicator()
				}
				position_drop_indicator()
				if (dragging.id !== self.data.section.id || dragging.position !== extractClosestEdge(self.data)) {
					dragging = {
						id: self.data.section.id,
						position: extractClosestEdge(self.data)
					}
				}
			},
			onDragEnter() {
				// Clear any pending drag leave timeout since we're entering a valid drop target
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}
				dragging_over_section = true
			},
			onDragLeave() {
				dragging_over_section = false
				// Use a timeout to avoid hiding the indicator when briefly leaving the area
				// but still dragging over a valid drop target
				drag_leave_timeout = setTimeout(() => {
					reset_drag()
				}, 100)
			},
			async onDrop({ self, source }) {
				// Immediately hide drop indicator
				hide_drop_indicator()

				// Clear any pending drag leave timeout
				if (drag_leave_timeout) {
					clearTimeout(drag_leave_timeout)
					drag_leave_timeout = null
				}

				const section_dragged_over_index =
					sections.length === 0 ? (page_type_body_sections.find((s) => s.id === self.data.section.id)?.index ?? 0) : (sections.find((s) => s.id === self.data.section.id)?.index ?? 0)
				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)

				if (closestEdgeOfTarget === 'top') {
					await add_section_to_page({
						symbol: block_being_dragged,
						position: section_dragged_over_index
					})
				} else if (closestEdgeOfTarget === 'bottom') {
					await add_section_to_page({
						symbol: block_being_dragged,
						position: section_dragged_over_index + 1
					})
				}
				reset_drag()
				$dragging_symbol = false
			}
		})
	}

	let page_is_empty = $derived(sections.length === 0)
	$effect(() => {
		if (sections_mounted === sections.length && sections_mounted !== 0) {
			page_mounted = true
		} else if (page_is_empty) {
			page_mounted = true
		}
	})
	let block_toolbar_on_locked_block = $derived($locked_blocks.find((b) => b === hovered_section?.id))
	$effect(() => {
		if (block_toolbar_on_locked_block) hide_block_toolbar()
	})

	let hovered_section_id: string | null = $state(null)
	let hovered_section = $derived(sections.find((s) => s.id === hovered_section_id))
	// Check if hovered section is a page type section (header/footer)
	let is_page_type_section = $derived(hovered_section_id && (header_sections.some((s) => s.id === hovered_section_id) || footer_sections.some((s) => s.id === hovered_section_id)))
	let editing_section = $state(false)
</script>

{#if hovered_section}
	<Dialog.Root
		bind:open={editing_section}
		onOpenChange={(open) => {
			if (!open) {
				// Check for unsaved changes before closing
				if (section_has_unsaved_changes) {
					if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
						// Prevent closing by reopening the dialog
						editing_section = true
						return
					}
					// User confirmed, discard changes
					manager.discard()
				}
			}
		}}
	>
		<Dialog.Content class="z-[999] max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4">
			<SectionEditor
				bind:has_unsaved_changes={section_has_unsaved_changes}
				component={hovered_section}
				tab={editing_section_tab}
				header={{
					button: {
						label: 'Save',
						onclick: () => {
							hovering_toolbar = false
							editing_section = false
						}
					}
				}}
			/>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Loading Spinner -->
{#if !page_mounted && sections.length > 1}
	<div class="spinner" style="--Spinner-color: var(--color-gray-7);">
		<UI.Spinner variant="loop" />
	</div>
{/if}

<!-- Drop Indicator -->
{#if showing_drop_indicator}
	<DropIndicator bind:node={drop_indicator_element} />
{/if}

<!-- Block Buttons -->
{#if showing_block_toolbar && !block_toolbar_on_locked_block}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute z-50"
		onmouseenter={() => {
			hovering_toolbar = true
		}}
		onmouseleave={() => {
			hovering_toolbar = false
			setTimeout(() => {
				if (!hovering_toolbar) {
					showing_block_toolbar = false
				}
			}, 50)
		}}
	>
		<BlockToolbar
			bind:node={block_toolbar_element}
			id={hovered_section_id}
			i={hovered_section?.index ?? 0}
			is_last={hovered_section?.index === sections.length - 1}
			is_instance_block={is_static_page_type || is_page_type_section}
			on:delete={async () => {
				// Get the section ID before clearing state
				const section_id_to_delete = hovered_section_id
				// Force hide the toolbar immediately
				showing_block_toolbar = false
				hovered_section_id = null
				hovered_block_el = null
				page_el.removeEventListener('scroll', position_block_toolbar)

				// Check if this is a page type section or regular page section
				const is_page_type_section = page_type_body_sections.some((s) => s.id === section_id_to_delete)

				if (is_page_type_section) {
					// Do not delete section from page type
				} else {
					// Delete from this specific page
					await remove_section_from_page(section_id_to_delete)
				}
			}}
			on:edit-code={() => edit_section('code')}
			on:edit-content={() => edit_section('content')}
			on:moveUp={async () => {
				if (!hovered_section) return

				let section_to_move = hovered_section

				if (!section_to_move || section_to_move.index === 0) return

				const section_above = sections.find((s) => s.index === section_to_move.index - 1)
				if (!section_above) return

				moving = true
				hide_block_toolbar()

				PageSections.update(section_to_move.id, { index: section_to_move.index - 1 })
				PageSections.update(section_above.id, { index: section_to_move.index })
				await manager.commit()

				setTimeout(() => {
					moving = false
				}, 300)
			}}
			on:moveDown={async () => {
				if (!hovered_section) return

				let section_to_move = hovered_section

				if (!section_to_move || section_to_move.index === sections.length - 1) return

				const section_below = sections.find((s) => s.index === section_to_move.index + 1)
				if (!section_below) return

				moving = true
				hide_block_toolbar()

				PageSections.update(section_to_move.id, { index: section_to_move.index + 1 })
				PageSections.update(section_below.id, { index: section_to_move.index })
				await manager.commit()

				setTimeout(() => {
					moving = false
				}, 300)
			}}
		/>
	</div>
{/if}

<!-- Page with Zone-Based Layout -->
<main id="Page" bind:this={page_el} class:fadein={true} class:dragging={$dragging_symbol} lang={$locale} use:drag_fallback style="display: flex; flex-direction: column; height: 100%;">
	<!-- Page Type Header Sections -->
	{#if header_sections.length > 0}
		<header class="page-header-zone">
			{#each header_sections as page_type_section (page_type_section.id)}
				{@const block = SiteSymbols.one(page_type_section.symbol)}
				{#if block}
					<div role="presentation" data-section={page_type_section.id} data-symbol={block?.id} class="page-type-section header-section">
						<ComponentNode {block} section={page_type_section} on:lock={() => {}} on:unlock={() => {}} on:mount={() => sections_mounted++} on:resize={() => {}} />
					</div>
				{/if}
			{/each}
		</header>
	{/if}

	<!-- Page Content Area -->
	<section class="page-content-zone flex-1 flex flex-col">
		<!-- Page's Own Sections -->
		{#each sections.filter((s) => SiteSymbols.one(s.symbol)) as section (section.id)}
			{@const block = SiteSymbols.one(section.symbol)!}
			{@const locked = $locked_blocks.find((b) => b === section.id)}
			{@const in_current_tab = false}
			{@const show_block_toolbar_on_hover = page_mounted && !moving}
			<div
				role="presentation"
				data-section={section.id}
				data-symbol={block?.id}
				onmousemove={(e) => {
					if (show_block_toolbar_on_hover && hovered_section_id === section.id) {
						show_block_toolbar()
					}
				}}
				onmouseenter={async (e) => {
					hovered_section_id = section.id
					hovered_block_el = e.currentTarget
					if (show_block_toolbar_on_hover) {
						show_block_toolbar()
					}
				}}
				onmouseleave={(e) => {
					// Only hide if we're not immediately entering another section
					setTimeout(() => {
						// Check if we've hovered over a different section in the meantime
						if (hovered_section_id === section.id) {
							hide_block_toolbar()
						}
					}, 50)
				}}
				animate:flip={{ duration: 100 }}
				use:drag_item={section}
			>
				{#if locked && !in_current_tab}
					<LockedOverlay {locked} />
				{/if}
				<ComponentNode
					{block}
					{section}
					on:lock={() => lock_block(section.id)}
					on:unlock={() => unlock_block()}
					on:mount={() => sections_mounted++}
					on:resize={() => {
						if (showing_block_toolbar) {
							position_block_toolbar()
						}
					}}
				/>
			</div>
		{/each}

		<!-- Empty State (show when page has no sections) -->
		{#if sections.length === 0}
			<div
				class="empty-state"
				class:dragging-over={hovered_block_el && dragging}
				style="height: 100%"
				onmouseenter={({ target }) => {
					hovered_block_el = target
				}}
				onmouseleave={() => {
					hovered_block_el = null
				}}
			>
				<div class="_container">
					<span>Drag blocks here to add them to the page</span>
				</div>
			</div>
		{/if}
	</section>

	<!-- Page Type Footer Sections -->
	{#if footer_sections.length > 0}
		<footer class="page-footer-zone">
			{#each footer_sections as page_type_section (page_type_section.id)}
				{@const block = SiteSymbols.one(page_type_section.symbol)}
				{#if block}
					<div role="presentation" data-section={page_type_section.id} data-symbol={block?.id} class="page-type-section footer-section">
						<ComponentNode {block} section={page_type_section} on:lock={() => {}} on:unlock={() => {}} on:mount={() => sections_mounted++} on:resize={() => {}} />
					</div>
				{/if}
			{/each}
		</footer>
	{/if}

	{#if site?.foot}
		<div class="site-foot">
			{@html site.foot}
		</div>
	{/if}
</main>

<style lang="postcss">
	[data-section] {
		overflow: hidden;
		position: relative;
		min-height: 2rem;
		line-height: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.empty-state {
		background: var(--color-gray-1);
		padding: 1rem;

		&:hover ._container {
			border-color: var(--weave-primary-color);
			background: var(--color-gray-2);
			color: var(--weave-primary-color);
		}

		&.dragging-over ._container {
			border-color: var(--weave-primary-color);
			background: rgba(248, 68, 73, 0.1);
			color: var(--weave-primary-color);
			transform: scale(1.02);
		}

		._container {
			height: 100%;
			width: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
			padding-block: 2rem;
			border: 2px dashed var(--color-gray-5);
			border-radius: 8px;
			min-height: 300px;
			color: var(--color-gray-7);
			font-size: 1.1rem;
			transition: all 0.1s ease;
		}

		span {
			pointer-events: none;
		}
	}

	[data-type='palette'] {
		.empty-state {
			background: var(--color-gray-1);
			display: flex;
			justify-content: center;
			padding-block: 5rem;
			border: 1px dotted;
			&.page_is_empty {
				height: 100%;
			}
		}
	}
	.spinner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		/* height: 100vh; */
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 5;
		--Spinner-font-size: 3rem;
		--Spinner-color: var(--weave-primary-color);
		--Spinner-color-opaque: rgba(248, 68, 73, 0.2);
	}
	main#Page {
		transition: 0.2s opacity;
		opacity: 0;
		border-top: 0;
		height: 100%;
		/* padding-top: 42px; */
		overflow: auto;
		box-sizing: border-box;
	}
	main.dragging :global(iframe) {
		pointer-events: none !important;
	}
	main#Page.fadein {
		opacity: 1;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: var(--color-gray-4);
		z-index: -2;
		font-family: Inter, sans-serif;
		color: var(--color-gray-7);
		z-index: 1;
		text-align: center;
	}
	.button {
		background: var(--color-gray-1);
		padding: 0.5rem 1rem;
		border-radius: var(--primo-border-radius);
		font-size: 0.875rem;
		text-decoration: none;
		color: var(--color-gray-7);
	}
	.site-foot {
		color: black;
	}
</style>
