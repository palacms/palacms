<script module>
	import { writable } from 'svelte/store'
</script>

<script>
	import Icon from '@iconify/svelte'
	import { createEventDispatcher, onMount } from 'svelte'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import CodeMirror from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import { get, set } from 'idb-keyval'

	const dispatch = createEventDispatcher()

	const left_pane_size = writable(33)
	const center_pane_size = writable(33)
	const right_pane_size = writable(33)

	/**
	 * @typedef {Object} Props
	 * @property {any} [data]
	 * @property {string} [html]
	 * @property {string} [css]
	 * @property {string} [js]
	 * @property {string} [storage_key] - Unique key for persisting pane state
	 */

	/** @type {Props} */
	let { data = {}, completions, html = $bindable(''), css = $bindable(''), js = $bindable(''), storage_key, onmod_e = () => {}, onmod_r = () => {}, oninput = () => {} } = $props()

	let html_pane_component = $state()
	let css_pane_component = $state()
	let js_pane_component = $state()

	let selections = $state({
		html: 0,
		css: 0,
		js: 0
	})

	let programmaticResize = false
	let initial_load_complete = $state(false)

	// Storage key for this editor's pane state
	const idb_key = storage_key ? `fullcodeeditor-panes-${storage_key}` : null

	// Load saved pane sizes (will be merged with the main onMount below)

	// Save pane sizes when they change
	async function save_pane_sizes() {
		if (!idb_key || programmaticResize || !initial_load_complete) return

		try {
			const sizes = {
				left: $left_pane_size,
				center: $center_pane_size,
				right: $right_pane_size
			}
			await set(idb_key, sizes)
		} catch (error) {
			console.warn('Failed to save pane sizes:', error)
		}
	}

	function toggleTab(tab) {
		const paneSizes = [$left_pane_size, $center_pane_size, $right_pane_size]

		// Check if this tab is currently collapsed (visually)
		const isCollapsed = paneSizes[tab] <= 5

		if (isCollapsed) {
			// Opening a collapsed tab - calculate new sizes
			const visibleCount = paneSizes.filter((size) => size > 5).length
			const newVisibleCount = visibleCount + 1

			const collapsedWidth = 4
			const totalCollapsedWidth = collapsedWidth * (3 - newVisibleCount)
			const activeWidth = (100 - totalCollapsedWidth) / newVisibleCount

			// Calculate new sizes first
			const newSizes = []
			for (let i = 0; i < 3; i++) {
				if (i === tab) {
					// This is the tab being opened
					newSizes[i] = activeWidth
				} else if (paneSizes[i] > 5) {
					// This tab is already visible, keep it at activeWidth
					newSizes[i] = activeWidth
				} else {
					// This tab should stay collapsed
					newSizes[i] = collapsedWidth
				}
			}

			// Set flag to prevent resize callbacks from updating stores
			programmaticResize = true

			// Update stores
			$left_pane_size = newSizes[0]
			$center_pane_size = newSizes[1]
			$right_pane_size = newSizes[2]

			// Use resize() method directly on each component
			requestAnimationFrame(() => {
				if (html_pane_component) {
					html_pane_component.resize(newSizes[0])
				}
				if (css_pane_component) {
					css_pane_component.resize(newSizes[1])
				}
				if (js_pane_component) {
					js_pane_component.resize(newSizes[2])
				}

				setTimeout(() => {
					programmaticResize = false
					save_pane_sizes()
				}, 100)
			})
		} else {
			// Closing an open tab
			const visibleCount = paneSizes.filter((size) => size > 5).length

			// Don't allow closing the last visible tab
			if (visibleCount === 1) {
				return
			}

			const newVisibleCount = visibleCount - 1
			const collapsedWidth = 4
			const totalCollapsedWidth = collapsedWidth * (3 - newVisibleCount)
			const activeWidth = (100 - totalCollapsedWidth) / newVisibleCount

			// Calculate new sizes for closing
			const newSizes = []
			for (let i = 0; i < 3; i++) {
				if (i === tab) {
					// This is the tab being closed
					newSizes[i] = collapsedWidth
				} else if (paneSizes[i] > 5) {
					// This tab should remain visible with new activeWidth
					newSizes[i] = activeWidth
				} else {
					// This tab should stay collapsed
					newSizes[i] = collapsedWidth
				}
			}

			// Set flag to prevent resize callbacks from updating stores
			programmaticResize = true

			// Update stores
			$left_pane_size = newSizes[0]
			$center_pane_size = newSizes[1]
			$right_pane_size = newSizes[2]

			// Use resize() method directly on each component
			requestAnimationFrame(() => {
				if (html_pane_component) {
					html_pane_component.resize(newSizes[0])
				}
				if (css_pane_component) {
					css_pane_component.resize(newSizes[1])
				}
				if (js_pane_component) {
					js_pane_component.resize(newSizes[2])
				}

				setTimeout(() => {
					programmaticResize = false
					save_pane_sizes()
				}, 100)
			})
		}
	}

	// close empty tabs on mount only
	onMount(async () => {
		// First, try to load saved pane sizes if we have a storage key
		if (idb_key) {
			try {
				const saved_sizes = await get(idb_key)
				if (saved_sizes) {
					$left_pane_size = saved_sizes.left || 33
					$center_pane_size = saved_sizes.center || 33
					$right_pane_size = saved_sizes.right || 33
					// Mark initial load as complete and skip empty tab logic
					initial_load_complete = true
					return
				}
			} catch (error) {
				console.warn('Failed to load pane sizes:', error)
			}
		}

		programmaticResize = true

		// Count tabs with content
		const hasContent = {
			html: !!html,
			css: !!css,
			js: !!js
		}
		const activeCount = (hasContent.html ? 1 : 0) + (hasContent.css ? 1 : 0) + (hasContent.js ? 1 : 0)

		// Only adjust if there are empty tabs
		if (activeCount < 3 && activeCount > 0) {
			const collapsedWidth = 4
			const totalCollapsedWidth = collapsedWidth * (3 - activeCount)
			const activeWidth = (100 - totalCollapsedWidth) / activeCount

			// Set each pane size based on content
			$left_pane_size = hasContent.html ? activeWidth : collapsedWidth
			$center_pane_size = hasContent.css ? activeWidth : collapsedWidth
			$right_pane_size = hasContent.js ? activeWidth : collapsedWidth

			// Ensure pane components resize properly
			requestAnimationFrame(() => {
				if (html_pane_component) {
					html_pane_component.resize($left_pane_size)
				}
				if (css_pane_component) {
					css_pane_component.resize($center_pane_size)
				}
				if (js_pane_component) {
					js_pane_component.resize($right_pane_size)
				}

				setTimeout(() => {
					programmaticResize = false
					save_pane_sizes()
				}, 100)
			})
		} else {
			// All tabs have content or no tabs have content, use default sizes
			programmaticResize = false
		}

		// Mark initial load as complete to enable saving
		initial_load_complete = true
	})

	let showing_local_key_hint = $state(false)
</script>

<PaneGroup direction="horizontal" class="flex h-full" autoSaveId="page-view">
	<Pane
		bind:this={html_pane_component}
		minSize={4}
		collapsible={true}
		collapsedSize={4}
		defaultSize={$left_pane_size}
		onResize={(size) => {
			// Only update if user is dragging, not programmatic changes
			if (!programmaticResize) {
				$left_pane_size = size
				save_pane_sizes()
			}
		}}
	>
		<div class="tabs">
			<button
				class:tab-hidden={$left_pane_size <= 5}
				onclick={(e) => {
					e.stopPropagation()
					toggleTab(0)
				}}
			>
				{#if showing_local_key_hint}
					<span class="vertical">&#8984; 1</span>
				{:else}
					<span>HTML</span>
				{/if}
			</button>
			<CodeMirror
				mode="html"
				{data}
				{completions}
				bind:value={html}
				bind:selection={selections['html']}
				on:mod-e
				on:mod-r
				on:modkeydown={() => (showing_local_key_hint = true)}
				on:modkeyup={() => (showing_local_key_hint = false)}
				on:tab-switch={({ detail }) => toggleTab(detail)}
				on:change={() => {
					dispatch('htmlChange')
					oninput()
				}}
				on:save
				on:refresh
			/>
		</div>
	</Pane>
	<PaneResizer
		class="PaneResizer"
		style="display: flex;
		align-items: center;
		justify-content: center;"
	>
		<span class="grab-handle">
			<Icon icon="mdi:drag-vertical-variant" />
		</span>
	</PaneResizer>
	<Pane
		bind:this={css_pane_component}
		minSize={4}
		collapsible={true}
		collapsedSize={4}
		defaultSize={$center_pane_size}
		style="position: relative;"
		onResize={(size) => {
			// Only update if user is dragging, not programmatic changes
			if (!programmaticResize) {
				$center_pane_size = size
				save_pane_sizes()
			}
		}}
	>
		<div class="tabs">
			<button
				class:tab-hidden={$center_pane_size <= 5}
				onclick={(e) => {
					e.stopPropagation()
					toggleTab(1)
				}}
			>
				{#if showing_local_key_hint}
					<span class="vertical">&#8984; 2</span>
				{:else}
					<span>CSS</span>
				{/if}
			</button>
			<CodeMirror
				on:modkeydown={() => (showing_local_key_hint = true)}
				on:modkeyup={() => (showing_local_key_hint = false)}
				on:tab-switch={({ detail }) => toggleTab(detail)}
				bind:selection={selections['css']}
				bind:value={css}
				mode="css"
				on:change={() => {
					dispatch('cssChange')
					oninput()
				}}
				on:mod-e
				on:mod-r
				on:save
				on:refresh
			/>
		</div>
	</Pane>
	<PaneResizer
		class="PaneResizer"
		style="display: flex;
		align-items: center;
		justify-content: center;"
	>
		<span class="grab-handle">
			<Icon icon="mdi:drag-vertical-variant" />
		</span>
	</PaneResizer>
	<Pane
		minSize={4}
		collapsible={true}
		collapsedSize={4}
		bind:this={js_pane_component}
		defaultSize={$right_pane_size}
		style="position: relative;"
		onResize={(size) => {
			// Only update if user is dragging, not programmatic changes
			if (!programmaticResize) {
				$right_pane_size = size
				save_pane_sizes()
			}
		}}
	>
		<div class="tabs">
			<button
				class:tab-hidden={$right_pane_size <= 5}
				onclick={(e) => {
					e.stopPropagation()
					toggleTab(2)
				}}
			>
				{#if showing_local_key_hint}
					<span class="vertical">&#8984; 3</span>
				{:else}
					<span>JS</span>
				{/if}
			</button>
			<CodeMirror
				on:modkeydown={() => (showing_local_key_hint = true)}
				on:modkeyup={() => (showing_local_key_hint = false)}
				on:tab-switch={({ detail }) => toggleTab(detail)}
				bind:selection={selections['js']}
				bind:value={js}
				mode="javascript"
				on:change={() => {
					dispatch('jsChange')
					oninput()
				}}
				on:mod-e
				on:mod-r
				on:save
				on:refresh
			/>
		</div>
	</Pane>
</PaneGroup>

<style lang="postcss">
	.tabs {
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;

		button {
			background: var(--color-gray-9);
			color: var(--primo-color-white);
			width: 100%;
			text-align: center;
			padding: 8px 0;
			outline: 0;
			font-size: var(--font-size-1);
			/* font-weight: 700; */
			z-index: 10;
			position: relative;

			&.tab-hidden {
				height: 100%;
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				background: #111;
				transition:
					background 0.1s,
					color 0.1s;
				z-index: 20;

				&:hover {
					background: var(--weave-primary-color);
					color: var(--primo-color-codeblack);
				}

				span {
					transform: rotate(270deg);
					display: block;
				}

				span.vertical {
					transform: initial;
				}
			}
		}
	}
</style>
