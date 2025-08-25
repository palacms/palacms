<script lang="ts">
	import Card from '$lib/builder/ui/Card.svelte'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Field } from '$lib/common/models/Field'
	import { useContent, useEntries, type Entity } from '$lib/Content.svelte'
	import type { FieldValueHandler } from './FieldsContent.svelte'
	import { fieldTypes } from '../../stores/app/index.js'
	import type { Component } from 'svelte'
	import Icon from '@iconify/svelte'
	import { current_user } from '$lib/pocketbase/user'

	let {
		entity,
		parent,
		field,
		fields,
		entries,
		level,
		onchange,
		ondelete,
		minimal
	}: {
		entity: Entity
		parent?: Entry
		field: Field
		fields: Field[]
		entries: Entry[]
		level: number
		onchange: FieldValueHandler
		ondelete?: (entry_id: string) => void
		minimal?: boolean
	} = $props()

	const field_type = $derived($fieldTypes.find((ft) => ft.id === field.type))
	const Field_Component = $derived(
		field_type?.component as
			| Component<{
					entity: Entity
					field: Field
					entry?: Entry
					fields: Field[]
					entries: Entry[]
					onchange: FieldValueHandler
					ondelete?: (entry_id: string) => void
					level: number
			  }>
			| undefined
	)

	const data = $derived(useContent(entity))
	const is_visible = $derived.by(() => {
		if (!field.config?.condition) return true // has no condition

		const { field: field_to_check, value, comparison } = field.config.condition

		// Find the field that this condition depends on
		const comparable_field = fields.find((f) => f.id === field_to_check)
		if (!comparable_field) return true // field not found, show by default

		// Check the condition
		const comparable_value = data[comparable_field.key]
		if (comparison === '=' && value === comparable_value) {
			return true
		} else if (comparison === '!=' && value !== comparable_value) {
			return true
		}

		return false // condition not met, hide field
	})
</script>

{#if !Field_Component}
	<!-- TODO: Improve the error message -->
	<span>Field type for the field is not found!</span>
{:else if is_visible}
	{@const [entry] = useEntries(entity, field, parent)}
	{@const title = ['repeater', 'group'].includes(field.type) ? field.label : null}
	{@const icon = undefined}
	{#if field.type === 'site-field' || field.type === 'page-field'}
		<div class="dynamic-header">
			{#if field.type === 'site-field'}
				<Icon icon="gg:website" />
				<span>Site Field</span>
			{:else if field.type === 'page-field'}
				<Icon icon="iconoir:page" />
				<span>Page Field</span>
			{/if}
		</div>
	{/if}
	<Card {title} {icon} {minimal}>
		<Field_Component {entity} {field} {fields} {entries} {entry} {level} {onchange} {ondelete} />
	</Card>
{:else if $current_user?.siteRole === 'developer' && !is_visible}
	<div class="hidden-field">
		<Icon icon="mdi:hidden" />
		<span>This field will be hidden from content editors</span>
	</div>
{/if}

<style>
	.dynamic-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		border-bottom: 1px solid var(--color-gray-9);
		padding-block: 0.5rem;
		font-size: 0.75rem;
	}
	.hidden-field {
		padding: 1rem;
		color: var(--color-gray-2);
		font-size: 0.875rem;
	}
</style>
