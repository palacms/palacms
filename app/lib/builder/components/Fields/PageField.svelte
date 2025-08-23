<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { site_context } from '$lib/builder/stores/context'
	import type { PageField } from '$lib/common/models/fields/PageField'
	import UI from '../../ui/index.js'

	const site = site_context.getOr(null)
	const { field }: { field: PageField } = $props()

	const dispatch = createEventDispatcher()

	const pageTypes = $derived.by(() => {
		const types = site?.page_types() || []
		return Array.isArray(types) ? types : []
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
