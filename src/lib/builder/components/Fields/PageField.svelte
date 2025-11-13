<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { site_context, page_type_context } from '$lib/builder/stores/context'
	import type { PageField } from '$lib/common/models/fields/PageField'
	import UI from '../../ui/index.js'

	const { value: site } = site_context.getOr({ value: null })
	const { value: current_page_type } = page_type_context.getOr({ value: null })
	const { field }: { field: PageField } = $props()

	const dispatch = createEventDispatcher()

	const pageTypes = $derived.by(() => {
		const types = site?.page_types() || []
		const typesArray = Array.isArray(types) ? types : []
		// Filter out current page type to prevent circular dependencies
		return typesArray.filter((type) => type.id !== current_page_type?.id)
	})
</script>

<div class="PagesField">
	<div class="container">
		<!-- Entity type -->
		<UI.Select
			on:input={({ detail }) => {
				dispatch('input', {
					config: {
						...field.config,
						page_type: detail
					}
				})
			}}
			label="Page Type"
			value={field.config?.page_type || ''}
			fullwidth={true}
			options={pageTypes.map((page_type) => ({
				label: page_type.name,
				value: page_type.id,
				icon: page_type.icon
			}))}
		/>
	</div>
</div>

<style>
	.container {
		display: grid;
		gap: 0.5rem;
	}
</style>
