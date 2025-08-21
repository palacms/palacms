<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { site_context } from '$lib/builder/stores/context'
	import type { PageFieldField } from '$lib/common/models/fields/PageFieldField.js'
	import UI from '../../ui/index.js'
	import { Sites } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte.js'
	import { watch } from 'runed'

	const site = site_context.get()
	const { field }: { field: PageFieldField } = $props()

	const dispatch = createEventDispatcher()

	function validate_field_key(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	// Get page type fields
	const allFields = $derived.by(() => {
		const pageTypes = site?.page_types() ?? []
		return pageTypes.flatMap((pageType) => {
			const fields = pageType.fields() || []
			return fields
				.filter((f) => !f.parent)
				.map((f) => ({
					...f,
					pageTypeName: pageType.name
				}))
		})
	})

	const field_list = $derived.by(() => {
		return allFields.map((f) => ({
			id: f.id,
			label: f.label || f.key,
			value: f.id
		}))
	})

	// auto-select first option (wait for field_list to populate)
	watch(
		() => field_list,
		() => {
			const first_option = field_list[0]
			if (field_list.length === 0 || field.config.field) return
			dispatch('input', {
				label: first_option.label,
				key: validate_field_key(first_option.label),
				config: {
					...field.config,
					field: first_option.id
				}
			})
		}
	)
</script>

<div class="PageFieldField">
	<div class="container">
		<!-- Field select -->
		<UI.Select
			fullwidth={true}
			on:input={({ detail }) => {
				const page_field = field_list.find((f) => f.id === detail)
				dispatch('input', {
					label: page_field?.label,
					key: validate_field_key(page_field?.label),
					config: {
						...field.config,
						field: page_field?.id
					}
				})
			}}
			label="Page Field"
			value={field.config?.field || (field_list.length > 0 ? field_list[0].id : '')}
			options={Array.isArray(field_list)
				? field_list.map((f) => ({
						label: f.label,
						value: f.id,
						icon: undefined
					}))
				: []}
		/>
	</div>
</div>

<style>
	.container {
		display: grid;
	}
</style>
