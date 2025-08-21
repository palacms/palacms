<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { site_context } from '$lib/builder/stores/context'
	import UI from '../../ui/index.js'
	import { Sites } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte.js'
	import { watch } from 'runed'

	const site = site_context.get()
	let { field } = $props()

	const dispatch = createEventDispatcher()

	function validate_field_key(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	// Get site fields for the current site
	const siteFields = $derived.by(() => {
		const list = site?.fields()
		return Array.isArray(list) ? list : []
	})

	let field_list = $derived.by(() => {
		return siteFields
			.filter((sf) => !sf.parent)
			.map((sf) => ({
				id: sf.id,
				label: sf.label || sf.key,
				value: sf.id
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
				dispatch('input', {
					config: {
						...field.config,
						field: detail
					}
				})
			}}
			label="Site Content"
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
