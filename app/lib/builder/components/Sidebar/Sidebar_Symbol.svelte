<script lang="ts">
	import * as _ from 'lodash-es'
	// import Icon from '@iconify/svelte'
	import Toggle from 'svelte-toggle'
	import { Button } from '$lib/components/ui/button'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import MenuPopup from '../../ui/Dropdown.svelte'
	import { locale } from '../../stores/app/misc'
	import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import IFrame from '../../components/IFrame.svelte'
	import { getContent } from '$lib/pocketbase/content'
	import { createEventDispatcher, onMount } from 'svelte'
	import { block_html } from '$lib/builder/code_generators'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { manager, SiteSymbols } from '$lib/pocketbase/collections'
	import { useExportSiteSymbol } from '$lib/ExportSymbol.svelte'

	const dispatch = createEventDispatcher()

	let {
		symbol,
		controls_enabled = true,
		show_toggle = false,
		toggled = false,
		head = '',
		append = ''
	}: { symbol: ObjectOf<typeof SiteSymbols>; controls_enabled?: boolean; show_toggle?: boolean; toggled?: boolean; head?: string; append?: string } = $props()

	let name_el = $state()

	let renaming = $state(false)
	let new_name = $state(symbol.name)
	async function toggle_name_input() {
		renaming = !renaming
		// workaround for inability to see cursor when div empty
		if (new_name === '') {
			new_name = 'Block'
		}
	}

	// Disabled CollectionMapping update to avoid reactive loops
	// $effect(() => {
	// 	SiteSymbols.update(symbol.id, { name: new_name })
	// })

	async function save_rename() {
		if (!symbol || !new_name.trim()) return

		try {
			SiteSymbols.update(symbol.id, { name: new_name.trim() })
			await manager.commit()
			renaming = false
		} catch (error) {
			console.warn('Failed to rename symbol:', error)
		}
	}

	let height = $state(0)

	const code = $derived({
		html: symbol.html,
		css: symbol.css,
		js: symbol.js
	})
	const fields = $derived(symbol.fields())
	const entries = $derived(symbol.entries())
	const data = $derived(fields && entries && (getContent(symbol, fields, entries)[$locale] ?? {}))

	let componentCode = $state()
	let component_error = $state()
	$effect(() => {
		if (!data) return
		block_html({
			code,
			data
		})
			.then((res) => {
				componentCode = res
			})
			.catch((error) => {
				component_error = error
			})
	})

	let element = $state()
	$effect(() => {
		if (element) {
			draggable({
				element,
				getInitialData: () => ({ block: symbol })
			})
		}
	})
	// move cursor to end of name
	$effect(() => {
		if (name_el) {
			const range = document.createRange()
			const sel = window.getSelection()
			range.setStart(name_el, 1)
			range.collapse(true)

			sel?.removeAllRanges()
			sel?.addRange(range)
		}
	})

	// Export symbol
	const exportSymbol = $derived(useExportSiteSymbol(symbol.id))
	async function export_symbol() {
		try {
			await exportSymbol.run()
		} catch (error) {
			console.error('Failed to export symbol:', error)
		}
	}
</script>

<Dialog.Root bind:open={renaming}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename Block</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your Block</p>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				save_rename()
			}}
		>
			<Input bind:value={new_name} placeholder="Enter new Block name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (renaming = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<div class="sidebar-symbol">
	<header>
		<div class="name">
			<h3>{symbol.name}</h3>
			{#if controls_enabled}
				<!-- TODO: add popover w/ symbol info -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- <div
					class="info"
					title={active_symbol_label}
					on:mouseover={get_label}
					on:focus={get_label}
				>
					<Icon icon="mdi:info" />
				</div> -->
			{/if}
		</div>
		{#if controls_enabled}
			<div class="symbol-options">
				{#if show_toggle}
					<Toggle label="Toggle Symbol for Page Type" disabled={component_error} hideLabel={true} {toggled} small={true} on:toggle />
				{/if}
				<MenuPopup
					icon="carbon:overflow-menu-vertical"
					options={[
						{
							label: 'Edit',
							icon: 'material-symbols:code',
							on_click: () => {
								dispatch('edit')
							}
						},
						{
							label: 'Export',
							icon: 'material-symbols:download',
							on_click: () => {
								export_symbol()
							}
						},
						{
							label: 'Rename',
							icon: 'clarity:edit-solid',
							on_click: () => {
								new_name = symbol.name
								renaming = true
							}
						},
						{
							label: 'Delete',
							icon: 'ic:outline-delete',
							on_click: () => {
								dispatch('delete')
							}
						}
					]}
				/>
			</div>
		{/if}
	</header>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="symbol-container" class:disabled={component_error} bind:this={element} data-test-id="symbol-{symbol.id}">
		{#if component_error}
			<div class="error">
				<!-- <Icon icon="heroicons:no-symbol-16-solid" /> -->
			</div>
		{:else if componentCode}
			<div class="symbol">
				<IFrame bind:height {append} {componentCode} />
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.sidebar-symbol {
		--IconButton-opacity: 0;

		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding-bottom: 0.5rem;
			color: #e7e7e7;
			transition: opacity 0.1s;
			gap: 1rem;

			.name {
				overflow: hidden;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 13px;
				line-height: 16px;

				h3 {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}

			.symbol-options {
				display: flex;
				align-items: center;
				color: #e7e7e7;
				gap: 3px;

				:global(svg) {
					height: 1rem;
					width: 1rem;
				}
			}
		}
	}
	.symbol-container {
		width: 100%;
		border-radius: 0.25rem;
		overflow: hidden;
		position: relative;
		cursor: grab;
		min-height: 2rem;
		transition: box-shadow 0.2s;
		background: var(--color-gray-8);

		&:after {
			content: '';
			position: absolute;
			inset: 0;
		}

		&.disabled {
			pointer-events: none;
		}
	}
	.error {
		display: flex;
		justify-content: center;
		height: 100%;
		position: absolute;
		inset: 0;
		align-items: center;
		/* background: #ff0000; */
	}
	[contenteditable] {
		outline: 0 !important;
	}
</style>
