<script lang="ts">
	import * as _ from 'lodash-es'
	import { tick, untrack } from 'svelte'
	import { fade } from 'svelte/transition'
	import { flip } from 'svelte/animate'
	import UI from '../../ui/index.js'
	import * as Dialog from '$lib/components/ui/dialog'
	import SectionEditor from '$lib/builder/views/modal/SectionEditor/SectionEditor.svelte'
	import ComponentNode from './Layout/ComponentNode.svelte'
	import BlockToolbar from './Layout/BlockToolbar-simple.svelte'
	import DropIndicator from './Layout/DropIndicator.svelte'
	import LockedOverlay from './Layout/LockedOverlay.svelte'
	import CodeEditor from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import { locale } from '../../stores/app/misc.js'
	import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import { manager, PageTypes, PageTypeSections, Sites } from '$lib/pocketbase/collections'

	import { page } from '$app/state'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	const host = $derived(page.url.host)
	const site = $derived(Sites.list({ filter: `host = "${host}"` })?.[0])
	const page_type_id = $derived(page.params.page_type)
	const page_type = $derived(PageTypes.one(page_type_id))
	const site_symbols = $derived(site?.symbols() ?? [])
	const page_type_sections = $derived(page_type?.sections() ?? [])
	const page_type_symbols = $derived(page_type?.symbols() ?? [])

	// Group sections by zone
	const header_sections = $derived(page_type_sections.filter((s) => s.zone === 'header'))
	const body_sections = $derived(page_type_sections.filter((s) => s.zone === 'body'))
	const footer_sections = $derived(page_type_sections.filter((s) => s.zone === 'footer'))

	// Page type head and foot editors
	let head = $state('')
	let foot = $state('')
	let save_timeout = null

	$effect.pre(() => {
		if (page_type) {
			head = page_type.head || ''
			foot = page_type.foot || ''
		}
	})

	async function save_page_type_code() {
		if (!page_type) return
		PageTypes.update(page_type.id, { head, foot })
		await manager.commit()
	}

	// Auto-save with delay
	function debounced_save() {
		if (save_timeout) {
			clearTimeout(save_timeout)
		}
		save_timeout = setTimeout(save_page_type_code, 1000) // 1 second delay
	}

	// Watch for changes to head and foot values
	$effect(() => {
		if (page_type && (head !== page_type.head || foot !== page_type.foot)) {
			debounced_save()
		}
	})

	// Check if page type is static (no symbols toggled)
	// Note: This relationship call might need to be replaced with direct collection access if it causes issues
	const is_static_page_type = $derived(page_type_symbols.length === 0)

	// Fade in page when all components mounted
	let page_mounted = $state(true)

	// detect when all sections are mounted
	let sections_mounted = $state(0)

	async function lock_block(block_id) {
		// TODO
	}

	function unlock_block() {
		// TODO
	}

	let hovered_section_id: string | null = $state(null)
	let hovered_section = $derived(page_type_sections.find((s) => s.id === hovered_section_id))

	let block_toolbar_element = $state()
	let page_el = $state()
	let hovered_block_el = $state()

	let showing_block_toolbar = $state(false)
	let hovering_toolbar = $state(false)

	// Handle unsaved changes for section editor
	let section_has_unsaved_changes = $state(false)
	async function show_block_toolbar() {
		showing_block_toolbar = true
		await tick()
		position_block_toolbar()
		page_el.addEventListener('scroll', () => {
			showing_block_toolbar = false
		})
	}

	function position_block_toolbar() {
		if (!hovered_block_el) return

		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const block_positions = {
			top: (top <= 43 ? 43 : top) + window.scrollY,
			bottom: bottom >= window.innerHeight ? 0 : window.innerHeight - bottom,
			left,
			right: window.innerWidth - right - window.scrollX
		}

		// Just update the styles without appending
		if (block_toolbar_element) {
			block_toolbar_element.style.top = `${block_positions.top}px`
			block_toolbar_element.style.bottom = `${block_positions.bottom}px`
			block_toolbar_element.style.left = `${block_positions.left}px`
			block_toolbar_element.style.right = `${block_positions.right}px`
		}
	}

	let hide_toolbar_timeout = null

	function hide_block_toolbar() {
		// Clear any existing timeout
		if (hide_toolbar_timeout) {
			clearTimeout(hide_toolbar_timeout)
		}
		// Increase delay to prevent toolbar flicker when moving between sections
		hide_toolbar_timeout = setTimeout(() => {
			if (!hovering_toolbar) {
				showing_block_toolbar = false
			}
		}, 300)
	}

	let editing_section_tab = $state('code')
	function edit_component(tab) {
		if (!hovered_section) return
		lock_block(hovered_section_id)
		editing_section_tab = tab
		editing_section = true
		editing_section_target = hovered_section
	}

	let moving = $state(false) // workaround to prevent block toolbar from showing when moving blocks

	// using instead of <svelte:head> to enable script tags
	function append_to_head(code) {
		const temp_container = document.createElement('div')
		temp_container.innerHTML = code

		const elements = Array.from(temp_container.childNodes)
		const scripts = []

		elements.forEach((child) => {
			if (child.tagName === 'SCRIPT') {
				scripts.push(child)
			} else {
				document.head.appendChild(child)
			}
		})

		function load_script(script_element) {
			return new Promise((resolve) => {
				const new_script = document.createElement('script')
				Array.from(script_element.attributes).forEach((attr) => {
					new_script.setAttribute(attr.name, attr.value)
				})

				if (script_element.src) {
					new_script.onload = resolve
					new_script.onerror = resolve // Proceed even if a script fails to load
				} else {
					new_script.textContent = script_element.textContent
				}

				document.head.appendChild(new_script)

				if (!script_element.src) {
					resolve()
				}
			})
		}

		scripts.reduce((promise, script_element) => {
			return promise.then(() => load_script(script_element))
		}, Promise.resolve())
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
			page_el.addEventListener('scroll', position_drop_indicator)
		}
	}

	function position_drop_indicator() {
		if (!hovered_block_el || !drop_indicator_element) return // hovering over page (i.e. below sections)

		// Only append if not already a child to avoid errors
		if (drop_indicator_element.parentNode !== hovered_block_el) {
			hovered_block_el.appendChild(drop_indicator_element)
		}

		const { top, left, bottom, right } = hovered_block_el.getBoundingClientRect()
		const block_positions = {
			top: (top <= 56 ? 56 : top) + window.scrollY,
			bottom: bottom >= window.innerHeight ? 0 : window.innerHeight - bottom,
			left,
			right: window.innerWidth - right - window.scrollX
		}
		drop_indicator_element.style.left = `${block_positions.left}px`
		drop_indicator_element.style.right = `${block_positions.right}px`

		// surround placeholder palette
		if (dragging.position === 'top' || !page_type_sections.length) {
			drop_indicator_element.style.top = `${block_positions.top}px`
		} else {
			drop_indicator_element.style.top = `initial`
		}

		if (dragging.position === 'bottom' || !page_type_sections.length) {
			drop_indicator_element.style.bottom = `${block_positions.bottom}px`
		} else {
			drop_indicator_element.style.bottom = `initial`
		}
	}

	function hide_drop_indicator() {
		showing_drop_indicator = false
		page_el.removeEventListener('scroll', position_drop_indicator)
	}

	let dragging = {
		id: null,
		position: null
	}
	function reset_drag() {
		dragging = {
			id: null,
			position: null
		}
		hide_drop_indicator()
		drop_handled = false // Reset the drop flag when drag ends
		active_drop_zone = null // Reset active drop zone
	}

	let dragging_over_section = false
	let drop_handled = false
	let active_drop_zone = null // Track which zone should handle the drop

	// detect drags over zones
	function drag_zone(element, zone) {
		dropTargetForElements({
			element,
			getData() {
				return { zone }
			},
			onDrag({ source }) {
				if (dragging_over_section) return // Don't interfere with section drops
			},
			async onDrop({ source }) {
				if (dragging_over_section || !page_type || !source.data.block) return

				const block_being_dragged = source.data.block
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === zone)
				const zone_target_index = zone_sections.length // Add to end of zone

				PageTypeSections.create({
					page_type: page_type.id,
					symbol: block_being_dragged.id,
					index: zone_target_index,
					zone: zone
				})
				await manager.commit()
			}
		})
	}

	// detect drags over the page (fallback)
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
				console.log('FALLBACK DRAG EVENT:', { dragging_over_section, active_drop_zone, source: source.data })
				if (dragging_over_section || active_drop_zone) return // Don't interfere with zone or section drops

				active_drop_zone = 'fallback'

				if (!showing_drop_indicator) {
					await show_drop_indicator()
				}
				position_drop_indicator()
				if (dragging.id !== 'PAGE' || dragging.position !== extractClosestEdge(self.data)) {
					dragging = {
						id: 'PAGE',
						position: extractClosestEdge(self.data)
					}
				}
			},
			onDragLeave() {
				reset_drag()
			},
			async onDrop({ self, source }) {
				console.log('FALLBACK DROP:', { dragging_over_section, drop_handled, active_drop_zone, block: source.data.block?.name })
				if (!page_type || dragging_over_section || drop_handled || active_drop_zone !== 'fallback') return // prevent double-adding block
				drop_handled = true

				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)

				// Default to body zone with zone-relative index
				const body_target_index = closestEdgeOfTarget === 'top' ? 0 : body_sections.length

				console.log(`FALLBACK DROP CREATING: zone=body, index=${body_target_index}`)
				PageTypeSections.create({
					page_type: page_type.id,
					symbol: block_being_dragged.id,
					index: body_target_index,
					zone: 'body'
				})
				await manager.commit()
				reset_drag()
				active_drop_zone = null

				// Don't reset drop_handled for fallback drops - let section drops take priority
			}
		})
	}

	function drag_item(element, section) {
		if (!element) return

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
			onDrag({ self, source }) {
				hovered_block_el = self.element
				if (dragging.id !== self.data.section.id || dragging.position !== extractClosestEdge(self.data)) {
					dragging = {
						id: self.data.section.id,
						position: extractClosestEdge(self.data)
					}
				}
			},
			onDragEnter() {
				dragging_over_section = true
			},
			onDragLeave() {
				dragging_over_section = false
			},
			async onDrop({ self, source }) {
				if (!page_type || !source.data.block) return

				const block_being_dragged = source.data.block
				const section_dragged_over = self.data.section
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				const section_zone = section_dragged_over.zone || 'body'

				// Find zone-relative index within the same zone
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone)
				const section_dragged_over_zone_index = zone_sections.findIndex((s) => s.id === section_dragged_over.id)
				const target_index = closestEdgeOfTarget === 'top' ? section_dragged_over_zone_index : section_dragged_over_zone_index + 1

				PageTypeSections.create({
					page_type: page_type.id,
					symbol: block_being_dragged.id,
					index: target_index,
					zone: section_zone
				})
				await manager.commit()
			}
		})
	}
	$effect(() => {
		if (sections_mounted === page_type?.sections.length && sections_mounted !== 0) {
			page_mounted = true
		}
	})

	let editing_section = $state(false)
	let editing_section_target = $state<ObjectOf<typeof PageTypeSections>>()
</script>

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
			component={editing_section_target}
			tab={editing_section_tab}
			bind:has_unsaved_changes={section_has_unsaved_changes}
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

<!-- Loading Spinner -->
{#if !page_mounted && page_type?.sections.length}
	<div class="spinner">
		<UI.Spinner variant="loop" />
	</div>
{/if}

<!-- Drop Indicator -->
{#if showing_drop_indicator}
	<DropIndicator bind:node={drop_indicator_element} />
{/if}

<!-- Block Buttons -->
{#if showing_block_toolbar}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="absolute z-50"
		onmouseenter={() => {
			hovering_toolbar = true
		}}
		onmouseleave={() => {
			showing_block_toolbar = false
		}}
	>
		<BlockToolbar
			bind:node={block_toolbar_element}
			id={hovered_section_id}
			i={page_type_sections.findIndex((s) => s.id === hovered_section_id)}
			is_last={page_type_sections.findIndex((s) => s.id === hovered_section_id) === page_type_sections.length - 1}
			on:delete={async () => {
				if (!hovered_section_id) return
				PageTypeSections.delete(hovered_section_id)
				await manager.commit()
			}}
			on:edit-code={() => edit_component('code')}
			on:edit-content={() => edit_component('content')}
			on:moveUp={async () => {
				if (!hovered_section_id) return
				moving = true
				hide_block_toolbar()

				const section = page_type_sections.find((s) => s.id === hovered_section_id)
				if (!section) return

				const section_zone = section.zone || 'body'
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone)
				const current_index = zone_sections.findIndex((s) => s.id === section.id)

				if (current_index > 0) {
					// Swap with the section above
					const section_above = zone_sections[current_index - 1]
					PageTypeSections.update(section.id, { index: current_index - 1 })
					PageTypeSections.update(section_above.id, { index: current_index })
					await manager.commit()
				}

				setTimeout(() => {
					moving = false
				}, 300)
			}}
			on:moveDown={async () => {
				if (!hovered_section_id) return
				moving = true
				hide_block_toolbar()

				const section = page_type_sections.find((s) => s.id === hovered_section_id)
				if (!section) return

				const section_zone = section.zone || 'body'
				const zone_sections = page_type_sections.filter((s) => (s.zone || 'body') === section_zone)
				const current_index = zone_sections.findIndex((s) => s.id === section.id)

				if (current_index < zone_sections.length - 1) {
					// Swap with the section below
					const section_below = zone_sections[current_index + 1]
					PageTypeSections.update(section.id, { index: current_index + 1 })
					PageTypeSections.update(section_below.id, { index: current_index })
					await manager.commit()
				}

				setTimeout(() => {
					moving = false
				}, 300)
			}}
		/>
	</div>
{/if}

<!-- Page Type Layout -->
<main id="#Page" data-test bind:this={page_el} class:fadein={page_mounted} lang={$locale}>
	<!-- Head Zone -->
	<div class="zone-label">Head</div>
	<section class="code-zone head-zone">
		<CodeEditor mode="html" bind:value={head} on:save={save_page_type_code} />
	</section>

	<!-- Header Zone -->
	<div class="zone-label">Header</div>
	<section class="page-zone header-zone" data-zone="header" use:drag_zone={'header'}>
		{#each header_sections as section (section.id)}
			{@const locked = undefined}
			{@const in_current_tab = false}
			{@const symbol = site_symbols.find((s) => s.id === section.symbol)}
			<div
				role="region"
				use:drag_item={section}
				data-section={section.id}
				data-symbol={symbol?.id}
				id="section-{section.id}"
				class:locked
				onmousemove={() => {
					if (!moving && !showing_block_toolbar) {
						show_block_toolbar()
					}
				}}
				onmouseenter={async ({ target }) => {
					hovered_section_id = section.id
					hovered_block_el = target
					if (!moving) {
						show_block_toolbar()
					}
				}}
				onmouseleave={() => {
					// Only hide if we're not immediately entering another section
					setTimeout(() => {
						// Check if we've hovered over a different section in the meantime
						if (hovered_section_id === section.id) {
							hide_block_toolbar()
						}
					}, 50)
				}}
				in:fade={{ duration: 100 }}
				animate:flip={{ duration: 100 }}
				data-test-id="page-type-section-{section.id}"
				style="min-height: 3rem;overflow:hidden;position: relative;"
			>
				{#if locked && !in_current_tab}
					<LockedOverlay {locked} />
				{/if}
				{#if symbol}
					<ComponentNode
						{section}
						block={symbol}
						on:lock={() => lock_block(section.id)}
						on:unlock={() => unlock_block()}
						on:mount={() => sections_mounted++}
						on:resize={() => {
							if (showing_block_toolbar) {
								position_block_toolbar()
							}
						}}
					/>
				{:else}
					<div style="background: #f44336; color: white; padding: 1rem; margin: 0.5rem;">
						⚠️ Symbol not found: {section.symbol}
					</div>
				{/if}
			</div>
		{/each}
		{#if header_sections.length === 0}
			<div class="empty-zone">
				<span>Drag blocks here for the header</span>
			</div>
		{/if}
	</section>

	<!-- Body Zone -->
	<div class="zone-label">
		Body
		{#if is_static_page_type}
			<span class="zone-mode">(Static)</span>
		{:else}
			<span class="zone-mode">(Dynamic)</span>
		{/if}
	</div>
	<section class="page-zone body-zone" data-zone="body" use:drag_zone={'body'}>
		{#each body_sections as section (section.id)}
			{@const locked = undefined}
			{@const in_current_tab = false}
			{@const symbol = site_symbols.find((s) => s.id === section.symbol)}
			<div
				role="region"
				use:drag_item={section}
				data-section={section.id}
				data-symbol={symbol?.id}
				id="section-{section.id}"
				class:locked
				onmousemove={() => {
					if (!moving && !showing_block_toolbar) {
						show_block_toolbar()
					}
				}}
				onmouseenter={async ({ target }) => {
					hovered_section_id = section.id
					hovered_block_el = target
					if (!moving) {
						show_block_toolbar()
					}
				}}
				onmouseleave={() => {
					// Only hide if we're not immediately entering another section
					setTimeout(() => {
						// Check if we've hovered over a different section in the meantime
						if (hovered_section_id === section.id) {
							hide_block_toolbar()
						}
					}, 50)
				}}
				in:fade={{ duration: 100 }}
				animate:flip={{ duration: 100 }}
				data-test-id="page-type-section-{section.id}"
				style="min-height: 3rem;overflow:hidden;position: relative;"
			>
				{#if locked && !in_current_tab}
					<LockedOverlay {locked} />
				{/if}
				{#if symbol}
					<ComponentNode
						{section}
						block={symbol}
						on:lock={() => lock_block(section.id)}
						on:unlock={() => unlock_block()}
						on:mount={() => sections_mounted++}
						on:resize={() => {
							if (showing_block_toolbar) {
								position_block_toolbar()
							}
						}}
					/>
				{:else}
					<div style="background: #f44336; color: white; padding: 1rem; margin: 0.5rem;">
						⚠️ Symbol not found: {section.symbol}
					</div>
				{/if}
			</div>
		{/each}
		{#if body_sections.length === 0}
			<div class="empty-zone main-body">
				{#if is_static_page_type}
					<span>Drag blocks here for static body content</span>
				{:else}
					<span>Drag blocks here for default body content (users can modify)</span>
				{/if}
			</div>
		{/if}
	</section>

	<!-- Footer Zone -->
	<div class="zone-label">Footer</div>
	<section class="page-zone footer-zone" data-zone="footer" use:drag_zone={'footer'}>
		{#each footer_sections as section (section.id)}
			{@const locked = undefined}
			{@const in_current_tab = false}
			{@const symbol = site_symbols.find((s) => s.id === section.symbol)}
			<div
				role="region"
				use:drag_item={section}
				data-section={section.id}
				data-symbol={symbol?.id}
				id="section-{section.id}"
				class:locked
				onmousemove={() => {
					if (!moving && !showing_block_toolbar) {
						show_block_toolbar()
					}
				}}
				onmouseenter={async ({ target }) => {
					hovered_section_id = section.id
					hovered_block_el = target
					if (!moving) {
						show_block_toolbar()
					}
				}}
				onmouseleave={() => {
					// Only hide if we're not immediately entering another section
					setTimeout(() => {
						// Check if we've hovered over a different section in the meantime
						if (hovered_section_id === section.id) {
							hide_block_toolbar()
						}
					}, 50)
				}}
				in:fade={{ duration: 100 }}
				animate:flip={{ duration: 100 }}
				data-test-id="page-type-section-{section.id}"
				style="min-height: 3rem;overflow:hidden;position: relative;"
			>
				{#if locked && !in_current_tab}
					<LockedOverlay {locked} />
				{/if}
				{#if symbol}
					<ComponentNode
						{section}
						block={symbol}
						on:lock={() => lock_block(section.id)}
						on:unlock={() => unlock_block()}
						on:mount={() => sections_mounted++}
						on:resize={() => {
							if (showing_block_toolbar) {
								position_block_toolbar()
							}
						}}
					/>
				{:else}
					<div style="background: #f44336; color: white; padding: 1rem; margin: 0.5rem;">
						⚠️ Symbol not found: {section.symbol}
					</div>
				{/if}
			</div>
		{/each}
		{#if footer_sections.length === 0}
			<div class="empty-zone">
				<span>Drag blocks here for the footer</span>
			</div>
		{/if}
	</section>

	<!-- Foot Zone -->
	<div class="zone-label">Foot</div>
	<section class="code-zone foot-zone">
		<CodeEditor mode="html" bind:value={foot} on:save={save_page_type_code} />
	</section>
</main>

<!-- {@html html_below || ''} -->

<style lang="postcss">
	.spinner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 5;
		--Spinner-font-size: 3rem;
		--Spinner-color: var(--weave-primary-color);
		--Spinner-color-opaque: rgba(248, 68, 73, 0.2);
	}
	main {
		padding: 0.5rem;
		background-color: var(--color-gray-950);
		transition: 0.2s opacity;
		opacity: 0;
		border-top: 0;
		height: 100%;
		/* padding-top: 42px; */
		overflow: auto;
		box-sizing: border-box;
	}
	main.fadein {
		opacity: 1;
	}

	.page-zone {
		padding: 0.5rem;
		position: relative;
		border: 2px dashed rgba(255, 255, 255, 0.1);
		transition: all 0.2s ease;
		overflow-y: auto;
		border-radius: 8px;
	}

	.page-zone.header-zone {
		border-style: solid;
	}

	.page-zone.body-zone {
		border-style: solid;
		max-height: none; /* Override the general max-height for body zone */
	}

	.page-zone.footer-zone {
		border-style: solid;
	}

	.zone-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: white;
		margin-left: 0.5rem;
		margin-top: 0.25rem;
		user-select: none;
	}

	.zone-mode {
		font-weight: 400;
		color: rgba(255, 255, 255, 0.5);
		font-size: 0.65rem;
		user-select: none;
	}

	.empty-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 80px;
		color: rgba(107, 114, 128, 0.8);
		font-size: 0.875rem;
		font-style: italic;
		border: 1px dashed rgba(107, 114, 128, 0.3);
		border-radius: 4px;
		user-select: none;
	}

	.empty-zone.main-body {
		min-height: 45vh;
		font-size: 1rem;
	}

	/* Make sections proper drop targets */
	[data-section] {
		overflow: hidden;
		position: relative;
		min-height: 3rem;
		border: 1px solid transparent;
		transition: border-color 0.2s ease;
	}

	[data-section]:hover {
		border-color: rgba(255, 255, 255, 0.1);
	}

	.code-zone {
		position: relative;
		border: 2px solid rgba(255, 255, 255, 0.2);
		margin-bottom: 1rem;
		background: var(--color-gray-900);
	}

	.code-zone.head-zone {
		border-color: rgba(76, 175, 80, 0.3);
	}

	.code-zone.foot-zone {
		border-color: rgba(255, 152, 0, 0.3);
	}
</style>
