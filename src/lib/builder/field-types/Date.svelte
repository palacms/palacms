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

	// Format date as YYYY-MM-DD for the input
	const format_date = (value: string | Date | undefined): string => {
		if (!value) return ''
		const date = typeof value === 'string' ? new Date(value) : value
		if (isNaN(date.getTime())) return ''
		return date.toISOString().split('T')[0]
	}

	const formatted_value = $derived(format_date(entry?.value))
</script>

<div>
	<UI.TextInput {...field} value={formatted_value} oninput={(text) => onchange({ [field.key]: { 0: { value: text } } })} type="date" />
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
</style>
