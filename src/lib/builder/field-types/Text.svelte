<script lang="ts">
	import UI from '../ui'
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
</script>

<div>
	<UI.TextInput {...field} value={entry?.value ?? ''} oninput={(text) => onchange({ [field.key]: { 0: { value: text } } })} />
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
</style>
