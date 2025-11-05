<script lang="ts">
	import UI from '../ui'
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

	const value = $derived(entry?.value)
	const options = $derived(field.config?.options || [])

	// Track if we've auto-selected to prevent repeated calls
	let has_auto_selected = $state(false)

	// Auto-select first option if no value is set (runs once when field has options and key)
	$effect(() => {
		if (!has_auto_selected && field.key && !value && options.length > 0) {
			const first_option = options[0]
			if (first_option && first_option.value !== undefined) {
				has_auto_selected = true
				onchange({ [field.key]: { 0: { value: first_option.value } } })
			}
		}
	})
</script>

<div class="SelectField">
	{#if options.length > 0}
		<UI.Select fullwidth={true} label={field.label} {options} {value} disable_auto_highlight={true} on:input={({ detail }) => onchange({ [field.key]: { 0: { value: detail } } })} />
	{:else}
		<span>This field doesn't have any options</span>
	{/if}
</div>

<style lang="postcss">
	.SelectField {
		width: 100%;
	}
</style>
