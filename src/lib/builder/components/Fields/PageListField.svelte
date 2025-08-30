<script lang="ts">
	import UI from '../../ui/index.js'
	import type { PageListField } from '$lib/common/models/fields/PageListField.js'
	import { site_context } from '$lib/builder/stores/context'
	import { createEventDispatcher } from 'svelte'

	const dispatch = createEventDispatcher()

	const site = site_context.getOr(null)
	const { field }: { field: PageListField } = $props()
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
			options={site?.page_types()?.map((page_type) => ({
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
