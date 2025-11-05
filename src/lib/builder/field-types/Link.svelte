<script lang="ts">
	import * as _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import UI from '../ui'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'
	import { site_context } from '$lib/builder/stores/context'
	import type { Field } from '$lib/common/models/Field'

	const { field, entry: passedEntry, onchange }: { field: Field; entry?: any; onchange: FieldValueHandler } = $props()

	const default_value = {
		label: '',
		url: '',
		page: null
	}

	const default_entry = { value: default_value }

	const { value: site } = site_context.getOr({ value: null })
	const entry = $derived(passedEntry || default_entry)
	const selectable_pages = $derived(site?.pages() ?? [])

	// Auto-select first page on open
	$effect(() => {
		const top_page = selectable_pages[0]
		const has_url = entry?.value?.url
		const has_page = entry?.value?.page
		if (!has_url && !has_page && selected === 'page') {
			onchange({ [field.key]: { 0: { value: { ...entry.value, page: top_page.id } } } })
		}
	})

	let selected = $derived<'page' | 'url'>(entry?.value?.url ? 'url' : 'page')
</script>

<div class="Link">
	<div class="inputs">
		<UI.TextInput
			label={field.label}
			oninput={(text) => {
				onchange({ [field.key]: { 0: { value: { ...entry.value, label: text } } } })
			}}
			value={entry.value.label}
			id="page-label"
			placeholder="About Us"
		/>
		<div class="url-select">
			<div class="toggle">
				<button class:active={selected === 'page'} onclick={() => (selected = 'page')} type="button">
					<Icon icon="iconoir:multiple-pages" />
					<span>Page</span>
				</button>
				<button class:active={selected === 'url'} onclick={() => (selected = 'url')} type="button">
					<Icon icon="akar-icons:link-chain" />
					<span>URL</span>
				</button>
			</div>
			{#if selected === 'page'}
				<UI.Select
					fullwidth={true}
					value={entry.value.page}
					options={selectable_pages.sort((a, b) => a.index - b.index).map((p) => ({ ...p, label: p.name, value: p.id }))}
					on:input={({ detail: pageId }) => {
						const page = selectable_pages.find((p) => p.id === pageId)
						if (page) {
							onchange({ [field.key]: { 0: { value: { ...entry.value, page: page.id, url: undefined } } } })
						}
					}}
				/>
			{:else}
				<UI.TextInput
					oninput={(text) => {
						onchange({ [field.key]: { 0: { value: { ...entry.value, url: text, page: undefined } } } })
					}}
					value={entry.value.url}
					type="url"
					placeholder="https://palacms.com"
				/>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.Link {
		display: flex;
		flex-direction: column;
	}

	.toggle {
		display: flex;
		background: var(--color-gray-9);
		border: 1px solid var(--color-gray-8);
		padding: 2px;
		border-radius: var(--primo-border-radius);
		--Dropdown-font-size: 0.875rem;

		button {
			border-radius: var(--primo-border-radius);
			font-size: 0.875rem;
			flex: 1;
			background: var(--color-gray-8);
			color: #8a8c8e;
			padding: 0.25rem 0.5rem;
			font-weight: 500;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			transition: 0.1s;
			background: transparent;

			&:focus,
			&.active {
				color: white;
				background: var(--color-gray-8);
				/* z-index: 1; */
			}
		}
	}

	.inputs {
		display: grid;
		gap: 0.5rem;
		width: 100%;

		.url-select {
			display: flex;
			gap: 0.25rem;
			flex-wrap: wrap;
		}
	}
</style>
