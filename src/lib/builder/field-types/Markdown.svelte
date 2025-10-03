<script lang="ts">
	import MarkdownCodeMirror from '$lib/builder/components/CodeEditor/MarkdownCodeMirror.svelte'
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

	function handle_change(value: string) {
		onchange({ [field.key]: { 0: { value } } })
	}
</script>

<label for={field.id}>
	<span class="primo--field-label">{field.label}</span>
	<MarkdownCodeMirror id={field.id} value={entry?.value} on:change={({ detail }) => handle_change(detail.value)} />
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

		:global(.cm-editor) {
			transition: border-color 0.1s ease;
		}
	}
</style>
