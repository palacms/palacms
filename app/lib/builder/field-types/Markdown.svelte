<script lang="ts">
	import { onMount } from 'svelte'
	import autosize from 'autosize'
	import { convert_markdown_to_html } from '../utils'
	import type { Entity } from '$lib/Content.svelte'
	import type { Field } from '$lib/common/models/Field'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'

	let {
		field,
		entry,
		onchange
	}: {
		entity: Entity
		field: Field
		entry?: Entry
		onchange: FieldValueHandler
	} = $props()

	// ensure value is correct shape
	let value = $derived.by(() => {
		if (typeof entry?.value === 'string') {
			return {
				markdown: entry.value,
				html: entry.value
			}
		} else if (typeof entry?.value !== 'object' || !entry?.value?.hasOwnProperty('markdown')) {
			return {
				markdown: '',
				html: ''
			}
		}
		return entry.value
	})

	let element = $state()

	onMount(() => autosize(element))

	async function parseContent(markdown) {
		const html = await convert_markdown_to_html(markdown)
		onchange({ [field.key]: { 0: { value: { html, markdown } } } })
	}
</script>

<label for={field.id}>
	<span class="primo--field-label">{field.label}</span>
	<textarea rows="1" bind:this={element} id={field.id} oninput={({ target }) => parseContent(target.value)} value={value.markdown}></textarea>
</label>

<style lang="postcss">
	label {
		display: flex;
		flex-direction: column;
		margin-bottom: 0.5rem;
		font-weight: 500;

		span {
			margin-bottom: 0.5rem;
		}

		textarea {
			background: var(--primo-color-codeblack);
			border: 1px solid var(--color-gray-8);
			color: var(--color-gray-2);
			font-weight: 400;
			border-radius: var(--input-border-radius);
			padding: 0.75rem;
			transition: 0.1s;
			font-size: 0.875rem;
			overflow: auto;

			&:focus {
				border-color: var(--color-gray-7);
				outline: 0;
			}
		}
	}
</style>
