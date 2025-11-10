<script>
	import Icon from '@iconify/svelte'
	import { createEventDispatcher, onMount } from 'svelte'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import CodeMirror from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import { mod_key_held } from '$lib/builder/stores/app/misc'
	import { writable } from 'svelte/store'

	const dispatch = createEventDispatcher()

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

	// Local pane sizes (Paneforge persists via autoSaveId)
	const left_pane_size = writable(96)
	const center_pane_size = writable(2)
	const right_pane_size = writable(2)

	// Smart default sizes based on content
	const has_html = $derived(html && html.trim().length > 0)
	const has_css = $derived(css && css.trim().length > 0)
	const has_js = $derived(js && js.trim().length > 0)
	const pane_count = $derived([has_html, has_css, has_js].filter(Boolean).length || 1)

	// Default sizes: if only HTML, make it 96%. If 2 panes, 50/50. If 3 panes, 48/48/4
	const default_html_size = $derived(pane_count === 1 ? 96 : pane_count === 2 ? 50 : 48)
	const default_css_size = $derived(!has_css ? 2 : pane_count === 2 && has_css ? 50 : 48)
	const default_js_size = $derived(!has_js ? 2 : pane_count === 2 && has_js ? 50 : 4)

	// Set up keyboard shortcuts for tab switching
	// Use a simple global keydown listener for when CodeMirror isn't focused
	// (tried using onModKey but it's wonkey here idk why)
	function handleGlobalKeydown(e) {
		// Check if CodeMirror has focus by checking if the active element is within a .cm-editor
		const isCodeMirrorFocused = document.activeElement?.closest('.cm-editor')

		// Only handle shortcuts when CodeMirror is NOT focused (CodeMirror handles its own)
		if (!isCodeMirrorFocused && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
			if (e.key === '1') {
				e.preventDefault()
				toggleTab(0)
			} else if (e.key === '2') {
				e.preventDefault()
				toggleTab(1)
			} else if (e.key === '3') {
				e.preventDefault()
				toggleTab(2)
			}
		}
	}

	// Add the global listener on mount
	$effect(() => {
		window.addEventListener('keydown', handleGlobalKeydown)

		return () => {
			window.removeEventListener('keydown', handleGlobalKeydown)
		}
	})

	let html_pane_component = $state()
	let css_pane_component = $state()
	let js_pane_component = $state()

	let selections = $state({
		html: 0,
		css: 0,
		js: 0
	})

	let programmaticResize = false

	// Save pane sizes when they change (Paneforge handles persistence)
	async function save_pane_sizes() {}

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

	// No programmatic sizing on mount; Paneforge restores from autoSaveId
</script>

<PaneGroup direction="horizontal" class="flex h-full" autoSaveId={storage_key ? `fullcode:${storage_key}` : 'fullcode:default'}>
	<Pane
		bind:this={html_pane_component}
		defaultSize={default_html_size}
		minSize={4}
		collapsible={true}
		collapsedSize={4}
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
				{#if $mod_key_held}
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
		defaultSize={default_css_size}
		minSize={4}
		collapsible={true}
		collapsedSize={4}
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
				{#if $mod_key_held}
					<span class="vertical">&#8984; 2</span>
				{:else}
					<span>CSS</span>
				{/if}
			</button>
			<CodeMirror
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
		defaultSize={default_js_size}
		minSize={4}
		collapsible={true}
		collapsedSize={4}
		bind:this={js_pane_component}
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
				{#if $mod_key_held}
					<span class="vertical">&#8984; 3</span>
				{:else}
					<span>JS</span>
				{/if}
			</button>
			<CodeMirror
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
					background: var(--pala-primary-color);
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
