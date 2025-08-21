<script lang="ts">
	import * as _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import UI from '../ui'
	import { locale } from '../stores/app'
	import type { LinkField } from '$lib/common/models/fields/LinkField'
	import { type Entity } from '$lib/pocketbase/content'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'
	import { site_context } from '$lib/builder/stores/context'

	const { entity, field, entry: passedEntry, onchange }: { entity: Entity; field: LinkField; entry?: any; onchange: FieldValueHandler } = $props()

	const default_value = {
		label: '',
		url: '',
		active: false
	}

	const default_entry = { value: default_value }

	const site = site_context.get()
	const entry = $derived(passedEntry || default_entry)
	const selectable_pages = $derived(site?.pages() ?? [])

	let selected = $state('url')
	let selected_page = $state(null)
	function get_page_url(page) {
		const prefix = $locale === 'en' ? '/' : `/${$locale}/`
		if (page.slug === '') {
			return prefix
		} else {
			let parent_urls = []
			return parent_urls.length ? prefix + parent_urls.join('/') + '/' + page.slug : prefix + page.slug
		}
	}
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
				<button class:active={selected === 'page'} onclick={() => (selected = 'page')}>
					<Icon icon="iconoir:multiple-pages" />
					<span>Page</span>
				</button>
				<button class:active={selected === 'url'} onclick={() => (selected = 'url')}>
					<Icon icon="akar-icons:link-chain" />
					<span>URL</span>
				</button>
			</div>
			{#if selected === 'page'}
				<UI.Select
					value={selected_page?.id}
					options={selectable_pages.map((p) => ({ ...p, label: p.name, value: p.id }))}
					on:input={({ detail: pageId }) => {
						const page = selectable_pages.find((p) => p.id === pageId)
						if (page) {
							selected_page = page
							onchange({ [field.key]: { 0: { value: { ...entry.value, page: page.id, url: get_page_url(page) } } } })
						}
					}}
				/>
			{:else}
				<UI.TextInput
					oninput={(text) => {
						onchange({ [field.key]: { 0: { value: { ...entry.value, url: text } } } })
					}}
					value={entry.value.url}
					type="url"
					placeholder="https://palacms.org"
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
