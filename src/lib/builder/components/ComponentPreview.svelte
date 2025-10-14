<script module>
	import { writable } from 'svelte/store'
	export const has_error = writable(true)

	export const auto_refresh = writable(true)
	export const preview_updated = writable(true)

	export const refresh_preview = writable(() => {})
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte'
	import { slide, fade } from 'svelte/transition'
	import { dynamic_iframe_srcdoc } from './misc.js'
	import { highlightedElement } from '../stores/app/misc'
	import { Inspect } from 'svelte-inspect-value'
	import Icon from '@iconify/svelte'
	import { content_editable } from '../utilities'
	import { processCode, processCSS } from '../utils.js'
	import { debounce } from 'lodash-es'
	import { watch } from 'runed'
	import { site_html } from '$lib/builder/stores/app/page.js'
	import _ from 'lodash-es'

	/**
	 * @typedef {Object} Props
	 * @property {string} [id]
	 * @property {Object} [code]?
	 * @property {string} [view]?
	 * @property {string} [orientation]?
	 * @property {boolean} [loading]?
	 * @property {boolean} [hideControls]?
	 * @property {any} [data]
	 * @property {string | null} [head]?
	 * @property {string} [append]?
	 */

	/** @type {Props} */
	let {
		id,
		code = {
			html: '',
			css: '',
			js: ''
		},
		view = $bindable('small'),
		orientation = $bindable('horizontal'),
		loading = $bindable(false),
		hideControls = false,
		data = undefined,
		append = ''
	} = $props()

	$preview_updated = false

	let compilation_error = $state(null)

	let componentApp = $state(null)
	let component_mounted = $state(false)
	let quiet_compile = $state(false)
	let last_error_html = $state(null)
	async function compile_component_code() {
		if (!code || !code.html || !data) return
		// disable_save = true
		if (!quiet_compile) {
			loading = true
		}

		await compile()
		// disable_save = compilationError
		setTimeout(() => {
			if (!quiet_compile) {
				loading = false
			}
			quiet_compile = false
		}, 200)

		async function compile() {
			const { js, error } = await processCode({
				component: {
					// head: code.head,
					html: code.html || '',
					css: code.css || '',
					js: code.js || '',
					data
				},
				buildStatic: false
			})

			if (error) {
				// Only update the error if it actually changed to avoid flicker/animations
				if (error !== last_error_html) {
					compilation_error = error
					last_error_html = error
				}
				$has_error = true
			} else {
				componentApp = js
				compilation_error = null
				last_error_html = null
				$has_error = false
			}
		}
	}

	compile_component_code()

	// Debounce compilation to prevent frequent recompilation during typing
	const debouncedCompile = debounce(compile_component_code, 100)
	// Debounced recompile specifically for data changes while in error state
	const debouncedDataRecompile = debounce(() => {
		quiet_compile = true
		compile_component_code()
	}, 250)

	// Set the refresh_preview store to the debounced compile function
	$effect(() => {
		$refresh_preview = debouncedCompile
	})

	let channel
	onMount(() => {
		channel = new BroadcastChannel(`preview-${id}`)
		channel.onmessage = ({ data }) => {
			const { event, payload } = data
			if (event === 'INITIALIZED') {
				iframe_loaded = true
			} else if (event === 'BEGIN') {
				// reset log & runtime error
				consoleLog = null
				compilation_error = null
			} else if (event === 'MOUNTED') {
				component_mounted = true
			} else if (event === 'SET_CONSOLE_LOGS') {
				consoleLog = data.payload.logs
			} else if (event === 'SET_ERROR') {
				compilation_error = data.payload.error
			} else if (event === 'SET_ELEMENT_PATH' && payload.loc) {
				$highlightedElement = payload.loc
			}
		}
		return () => {
			channel?.close()
		}
	})

	let consoleLog = $state()

	let iframe = <HTMLIFrameElement>$state()

	function append_to_iframe(code) {
		var container = document.createElement('div')
		container.innerHTML = code
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.head.appendChild(node)
		})
	}

	// inject updated component CSS to avoid having to recompile the whole thing on each style change
	// NOTE: this introduces a bug where writing bare styles will target generated HTML (ie from Markdown/RichText) since injected styles aren't scoped
	// but that's an acceptable tradeoff atm for the better UX
	async function update_css(raw_css) {
		if (!iframe || !iframe.contentDocument || !componentApp) return
		const doc = iframe.contentDocument

		// if css contains any :global styles, just recompile everything
		if (/:global/.test(raw_css)) {
			debouncedCompile()
		} else {
			const final_css = await processCSS(raw_css)
			console.log({ final_css })
			let styleTag = doc.querySelector('style[id^="svelte-"]')
			styleTag!.textContent = final_css
		}
	}
	watch(
		() => code.css,
		(css) => {
			update_css(css)
		}
	)

	let container = $state()
	let iframe_loaded = $state(false)

	let scale = $state()
	let height = $state()
	async function resizePreview() {
		if (view && container && iframe) {
			await tick()
			const { clientWidth: parentWidth } = container
			const { clientWidth: childWidth } = iframe
			const scaleRatio = parentWidth / childWidth
			scale = `scale(${scaleRatio})`
			height = 100 / scaleRatio + '%'
		}
	}

	function cycle_preview() {
		if (active_static_width === static_widths.phone) {
			set_preview(static_widths.tablet)
		} else if (active_static_width === static_widths.tablet) {
			set_preview(static_widths.laptop)
		} else if (active_static_width === static_widths.laptop) {
			set_preview(static_widths.desktop)
		} else {
			set_preview(static_widths.phone)
		}
		resizePreview()
	}

	function set_preview(size) {
		active_static_width = size
	}

	async function changeView() {
		if (view === 'small') {
			view = 'large'
			resizePreview()
		} else {
			view = 'small'
		}
	}

	async function setIframeApp() {
		channel.postMessage({
			event: 'SET_APP',
			payload: { componentApp, data }
		})
	}

	function setIframeData() {
		// When there's a compile error, field edits can spam recompiles and cause flicker.
		// Debounce a quiet recompile attempt, and avoid touching the iframe until success.
		if (compilation_error && $auto_refresh) {
			debouncedDataRecompile()
			return
		}
		// reload the app if it crashed from an error
		const div = iframe?.contentDocument?.querySelector('#page')
		if (div?.innerHTML === '') {
			setIframeApp()
		} else if (iframe_loaded) {
			channel.postMessage({
				event: 'SET_APP_DATA',
				payload: { data }
			})
		}
	}

	let previewWidth = $state()

	const static_widths = {
		phone: 300,
		tablet: 600,
		laptop: 1200,
		desktop: 1600
	}
	let active_static_width = $state(static_widths.laptop)

	function getIcon(width) {
		if (width < static_widths.tablet) {
			return 'bi:phone'
		} else if (width < static_widths.laptop) {
			return 'ant-design:tablet-outlined'
		} else if (width < static_widths.desktop) {
			return 'bi:laptop'
		} else {
			return 'akar-icons:desktop-device'
		}
	}

	function toggleOrientation() {
		if (orientation === 'vertical') {
			orientation = 'horizontal'
		} else if (orientation === 'horizontal') {
			orientation = 'vertical'
		}
	}

	let last_signature = `${code.html}--${code.js}`
	watch(
		() => [code.html, code.js, $auto_refresh],
		([html, js, refresh]) => {
			if (!refresh) return
			const new_signature = `${html}--${js}`
			if (new_signature === last_signature) return
			debouncedCompile()
			last_signature = new_signature
		}
	)

	$effect(() => {
		if (iframe) {
			// open clicked links in browser
			iframe.contentWindow.document.querySelectorAll('a').forEach((link) => {
				link.target = '_blank'
			})
			append_to_iframe(append)
		}
	})

	watch(
		() => [componentApp, iframe_loaded],
		() => {
			if (!componentApp || !iframe_loaded) return
			setIframeApp()
		}
	)

	let last_data = _.cloneDeep(data)
	watch(
		() => data,
		(data) => {
			if (!data || _.isEqual(last_data, data)) return
			setIframeData()
			last_data = _.cloneDeep(data)
		}
	)

	$effect(() => {
		;(previewWidth, resizePreview())
	})
	let active_dynamic_icon = $derived(getIcon(previewWidth))
	let active_static_icon = $derived(getIcon(active_static_width))
</script>

<div class="code-preview">
	{#if compilation_error}
		<pre transition:slide|local={{ duration: 100 }} class="error-container">
      {@html compilation_error}
    </pre>
	{/if}

	{#if consoleLog}
		<div class="logs" transition:slide|local>
			<Inspect value={consoleLog} theme="dark" borderless={true} noanimate={true} showTools={false} />
		</div>
	{/if}
	<div in:fade class="preview-container" class:loading bind:this={container} bind:clientWidth={previewWidth}>
		<iframe
			tabindex="-1"
			style:transform={view === 'large' ? scale : ''}
			style:height={view === 'large' ? height : '100%'}
			class:fadein={component_mounted}
			style:width={view === 'large' ? `${active_static_width}px` : '100%'}
			title="Preview HTML"
			srcdoc={dynamic_iframe_srcdoc($site_html, `preview-${id}`)}
			bind:this={iframe}
		></iframe>
	</div>
	{#if !hideControls}
		<div class="footer-buttons">
			<div class="preview-width">
				{#if view === 'large'}
					<button onclick={cycle_preview}>
						<Icon icon={active_static_icon} height="1rem" />
					</button>
					<button>
						<div
							class="static-width"
							use:content_editable={{
								on_change: (e) => {
									active_static_width = Number(e.target.textContent)
									resizePreview()
								}
							}}
						>
							{active_static_width}
						</div>
					</button>
				{:else}
					<span>
						<Icon icon={active_dynamic_icon} height="1rem" />
					</span>
					<span>
						{previewWidth}
					</span>
				{/if}
			</div>
			<button class="switch-view" onclick={changeView}>
				<Icon icon={view === 'small' ? 'fa-solid:compress-arrows-alt' : 'fa-solid:expand-arrows-alt'} />
				{#if view === 'large'}
					<span>static width</span>
				{:else}
					<span>dynamic width</span>
				{/if}
			</button>
			<button onclick={toggleOrientation} class="preview-orientation">
				{#if orientation === 'vertical'}
					<Icon icon="charm:layout-rows" />
				{:else if orientation === 'horizontal'}
					<Icon icon="charm:layout-columns" />
				{/if}
			</button>
			<button title="Toggle auto-refresh (refresh with Command R)" class="auto-refresh" class:toggled={$auto_refresh} onclick={() => ($auto_refresh = !$auto_refresh)}>
				<Icon icon="bx:refresh" />
			</button>
		</div>
	{/if}
</div>

<svelte:window onresize={resizePreview} />

<style lang="postcss">
	.code-preview {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;

		.error-container {
			color: var(--primo-color-white);
			background: var(--primo-color-danger);
			padding: 5px;
		}

		.logs {
		}
	}
	iframe {
		opacity: 0;
		border: 0;
		transition: opacity 0.2s;
		background: var(--primo-color-white);
		height: 100%;
		width: 100%;
		transform-origin: top left;
	}
	.fadein {
		opacity: 1;
	}
	.preview-container {
		background: var(--primo-color-white);
		border: 2px solid var(--color-gray-8);
		overflow: hidden;
		transition: border-color 0.2s;
		will-change: border-color;
		border-bottom: 0;
		flex: 1;
	}
	.preview-container.loading {
		border-color: var(--color-gray-7);
	}
	.footer-buttons {
		display: flex;
		flex-wrap: wrap;

		.preview-width {
			background: var(--primo-color-black);
			font-weight: 500;
			z-index: 10;
			display: flex;
			align-items: center;

			span {
				padding: 0.5rem;
				font-size: 0.75rem;
				border: 1px solid var(--color-gray-9);
				background: var(--color-gray-9);

				&:first-child {
					padding-right: 0;
				}

				&:last-child {
					padding-left: 0.25rem;
				}
			}

			.static-width {
				&:focus-visible {
					outline: none;
				}
				&::selection {
					background: var(--color-gray-7);
				}
			}
		}

		.switch-view {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
		}

		.preview-orientation {
			font-size: 1.25rem;
			padding: 0.25rem 0.5rem;
		}

		.auto-refresh {
			font-size: 1.5rem;
			padding: 0.25rem 0.5rem;
			opacity: 0.5;

			&.toggled {
				opacity: 1;
			}
		}
	}

	.footer-buttons {
		button {
			outline: 0;
			background: var(--color-gray-9);
			border: 1px solid var(--color-gray-8);
			font-size: var(--font-size-1);
			padding: 0.5rem;
			display: block;
			text-align: center;
			transition: var(--transition-colors);

			&:hover {
				background: var(--color-gray-8);
			}
		}
	}
</style>
