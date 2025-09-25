<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import { page_context, page_type_context } from '$lib/builder/stores/context'
	import { PageTypes, PageTypeFields } from '$lib/pocketbase/collections'
	import type { PageFieldField } from '$lib/common/models/fields/PageFieldField.js'
	import UI from '../../ui/index.js'
	import { Button } from '$lib/components/ui/button'
	import { watch } from 'runed'
	import { fieldTypes } from '../../stores/app'

	const { field }: { field: PageFieldField } = $props()

	const dispatch = createEventDispatcher()

	function validate_field_key(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	// Determine active page type (Page editor or Page Type editor)
	const { value: page_ctx } = page_context.getOr({ value: null })
	const { value: page_type_ctx } = page_type_context.getOr({ value: null })

	const active_page_type = $derived.by(() => {
		if (page_type_ctx) return page_type_ctx
		if (page_ctx) return PageTypes.one(page_ctx.page_type)
		return null
	})

	const active_page_type_name = $derived(active_page_type?.name || '')

	// Get fields only for the active page type
	const all_fields = $derived.by(() => {
		const fields = active_page_type?.fields?.() || []
		return (fields || []).filter((f) => !f.parent).map((f) => ({ ...f }))
	})

	// Selected page field (may belong to different page type)
	const selected_page_field = $derived.by(() => (field.config?.field ? PageTypeFields.one(field.config.field) : null))
	const selected_page_type = $derived.by(() => (selected_page_field ? PageTypes.one(selected_page_field.page_type) : null))

	// True if the saved selection isn't available on the active page type
	const is_missing_in_active_type = $derived.by(() => {
		if (!active_page_type) return false
		if (!field.config?.field) return false
		return !all_fields.some((f) => f.id === field.config.field)
	})

	const field_list = $derived.by(() => {
		return all_fields.map((f) => {
			const ft = $fieldTypes.find((t) => t.id === f.type)
			return {
				id: f.id,
				label: f.label || f.key,
				value: f.id,
				icon: ft?.icon
			}
		})
	})

	// auto-select first option (wait for field_list to populate), but avoid when foreign-linking is present or after manual disconnect
	let skip_autoselect = $state(false)
	let autofilled = $state(false)
	watch(
		() => ({ list: field_list, missing: is_missing_in_active_type, skip: skip_autoselect }),
		({ list, missing, skip }) => {
			const first_option = list[0]
			if (!first_option || field.config?.field || missing || skip || autofilled) return
			dispatch('input', {
				label: field.label || first_option.label,
				key: field.key || validate_field_key(first_option.label),
				config: {
					...field.config,
					field: first_option.id
				}
			})
			if (!(field.label || field.key)) {
				autofilled = true
			}
		}
	)
</script>

<div class="PageFieldField">
	<div class="container">
		{#if is_missing_in_active_type}
			<div class="foreign-notice">
				<p>
					This Page Field points to
					<strong>{selected_page_field?.label || selected_page_field?.key || 'Unknown field'}</strong>
					{#if selected_page_type}
						from <strong>{selected_page_type.name}</strong>
					{:else}
						from a different page type which is no longer available
					{/if}
					and isn’t available on this page type ({active_page_type_name}).
				</p>
				<p class="subtle mb-2">Disconnecting will remove this link. If this block is also used on pages of the other page type, it may break there until reconfigured.</p>
				<Button
					size="sm"
					variant="destructive"
					onclick={() => {
						skip_autoselect = true
						dispatch('input', { config: { ...field.config, field: null } })
						setTimeout(() => (skip_autoselect = false), 0)
					}}
				>
					Disconnect
				</Button>
			</div>
		{:else}
			<!-- Field select -->
			<UI.Select
				fullwidth={true}
				on:input={({ detail }) => {
					const page_field = field_list.find((f) => f.id === detail)
					dispatch('input', {
						label: autofilled ? page_field?.label : field.label, // only autofill if already autofilling
						key: autofilled ? validate_field_key(page_field?.label) : field.key,
						config: {
							...field.config,
							field: page_field?.id
						}
					})
				}}
				label={`Page Field${active_page_type_name ? ` (${active_page_type_name})` : ''}`}
				value={field.config?.field || (field_list.length > 0 ? field_list[0].id : '')}
				options={Array.isArray(field_list)
					? field_list.map((f) => ({
							label: f.label,
							value: f.id,
							icon: f.icon
						}))
					: []}
			/>
		{/if}
	</div>
</div>

<style>
	.container {
		display: grid;
	}

	.foreign-notice {
		border: 1px solid var(--color-gray-9);
		background: #111;
		border-radius: 4px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		font-size: 0.875rem;
		color: var(--color-gray-2);
	}
	.foreign-notice p.subtle {
		font-size: 0.75rem;
		opacity: 0.8;
	}
</style>
