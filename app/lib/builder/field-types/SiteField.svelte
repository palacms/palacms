<script lang="ts">
	import { fieldTypes } from '../stores/app'
	import { SiteFields, SiteEntries } from '$lib/pocketbase/collections'
	import type { Entry } from '$lib/common/models/Entry'
	import { getDirectEntries, type Entity } from '$lib/pocketbase/content'
	import { setFieldEntries, type FieldValueHandler, type FieldValueMap } from '../components/Fields/FieldsContent.svelte'
	import type { Field } from '$lib/common/models/Field'
	import { site_context } from '$lib/builder/stores/context'

	const {
		entity,
		field,
		onchange,
		level
	}: {
		entity: Entity
		field: Field
		entry?: Entry
		fields: Field[]
		entries: Entry[]
		onchange: FieldValueHandler
		level: number
	} = $props()

	// Resolve the actual site field being referenced
	const resolvedField = $derived.by(() => {
		if (!field.config?.field) return null
		return SiteFields.one(field.config.field)
	})

	// Get the field type for the resolved field
	const fieldType = $derived.by(() => {
		if (!resolvedField) return null
		return $fieldTypes.find((ft) => ft.id === resolvedField.type)
	})

	const site = site_context.get()
	const fields = $derived(site?.fields() ?? [])
	const entries = $derived(site?.entries() ?? [])
	const entry = $derived(resolvedField && getDirectEntries(entity, resolvedField, entries)[0])

	// Handle changes to the site field by updating the entry
	function handleFieldChange(values: FieldValueMap) {
		setFieldEntries({ fields, entries, updateEntry: SiteEntries.update, createEntry: SiteEntries.create, values })
	}
</script>

{#if resolvedField && fieldType && entry}
	{@const SvelteComponent = fieldType.component}
	<SvelteComponent {entity} field={{ ...resolvedField, label: field.label }} {entry} {fields} {entries} onchange={handleFieldChange} {level} />
{:else if !field.config?.field}
	<span>Please configure this field to select a site field.</span>
{:else if !entry}
	<span>No value found for this site field.</span>
{:else}
	<span>This field has been deleted or disconnected.</span>
{/if}

<style lang="postcss">
</style>
