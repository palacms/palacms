<script lang="ts">
	import { fieldTypes } from '../stores/app'
	import { PageTypeFields, PageTypes } from '$lib/pocketbase/collections'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Entity } from '$lib/Content.svelte'
	import { PageEntries } from '$lib/pocketbase/collections'
	import { setFieldEntries, type FieldValueHandler, type FieldValueMap } from '../components/Fields/FieldsContent.svelte'
	import type { Field } from '$lib/common/models/Field'
	import { page_context } from '$lib/builder/stores/context'

	const {
		entity,
		field,
		entry,
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

	// Resolve the actual page field being referenced
	const resolvedField = $derived.by(() => {
		if (!field.config?.field) return null
		return PageTypeFields.one(field.config.field)
	})

	// Get the field type for the resolved field
	const fieldType = $derived.by(() => {
		if (!resolvedField) return null
		return $fieldTypes.find((ft) => ft.id === resolvedField.type)
	})

	const page = page_context.get()
	const page_type = $derived(PageTypes.one(page.page_type))
	const fields = $derived(page_type?.fields() ?? [])
	const entries = $derived(page?.entries() ?? [])

	// Handle changes to the page field by updating the entry
	function handleFieldChange(values: FieldValueMap) {
		setFieldEntries({
			fields,
			entries,
			updateEntry: PageEntries.update,
			createEntry: (data) => {
				if (!page) {
					throw new Error('No page')
				}

				return PageEntries.create({ ...data, page: page.id })
			},
			values
		})
	}
</script>

{#if resolvedField && fieldType && entry}
	{@const SvelteComponent = fieldType.component}
	<SvelteComponent {entity} field={{ ...resolvedField, label: field.label }} {entry} {fields} {entries} onchange={handleFieldChange} {level} />
{:else if !field.config?.field}
	<span>Please configure this field to select a page field.</span>
{:else if !entry}
	<span>No value found for this page field.</span>
{:else}
	<span>This field has been deleted or disconnected.</span>
{/if}
