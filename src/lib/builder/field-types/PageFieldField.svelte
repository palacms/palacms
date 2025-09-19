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

	const { value: page } = page_context.getOr({ value: null })
	const page_type = $derived(page && PageTypes.one(page.page_type))
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
		onchange({})
	}

	function deleteEntryRelatedRecords(entry_id: string) {
		// Delete all sub-entries.
		for (const entry of entries) {
			if (entry.parent === entry_id) {
				deleteEntryRelatedRecords(entry.id)
				PageEntries.delete(entry.id)
			}
		}
	}

	function handleDeleteEntry(entry_id: string) {
		deleteEntryRelatedRecords(entry_id)
		PageEntries.delete(entry_id)
	}
</script>

{#if page && resolvedField && fieldType}
	{@const SvelteComponent = fieldType.component}
	<SvelteComponent entity={page} field={{ ...resolvedField, label: field.label }} {entry} {fields} {entries} onchange={handleFieldChange} ondelete={handleDeleteEntry} {level} />
{:else if !field.config?.field}
	<span>Please configure this field to select a page field.</span>
{:else if !entry}
	<span>No value found for this page field.</span>
{:else}
	<span>This field has been deleted or disconnected.</span>
{/if}
