<script lang="ts">
	import autosize from 'autosize'
	import { onMount } from 'svelte'
	import TextInput from '../ui/TextInput.svelte'
	import type { Entity } from '$lib/Entity'
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

	let element
	onMount(() => {
		autosize(element)
	})
</script>

<TextInput label={field.label} value={entry?.value} grow={true} oninput={(value) => onchange({ [field.key]: { 0: { value } } })} />

<style lang="postcss">
</style>
