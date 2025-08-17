<script lang="ts">
	import { page } from '$app/state'
	import { createEventDispatcher } from 'svelte'
	import type { PageFieldField } from '$lib/common/models/fields/PageFieldField.js'
	import UI from '../../ui/index.js'
	import { Sites } from '$lib/pocketbase/collections'

	const host = $derived(page.url.host)
	const site = $derived(Sites.list({ filter: `host = "${host}"` })?.[0])
	const { field }: { field: PageFieldField } = $props()

	const dispatch = createEventDispatcher()

	// Get page type fields
	const allFields = $derived.by(() => {
		const pageTypes = site?.page_types() ?? []
		return pageTypes.flatMap((pageType) => {
			const fields = pageType.fields() || []
			return fields.map((f) => ({
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
</script>

<div class="PageFieldField">
	<div class="container">
		<!-- Field select -->
		<UI.Select
			fullwidth={true}
			on:input={({ detail }) => {
				dispatch('input', {
					config: {
						...field.config,
						field: detail
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
