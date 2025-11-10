<script>
	import UI from '../../ui/index.js'
	import { createEventDispatcher } from 'svelte'

	const dispatch = createEventDispatcher()

	let { field } = $props()

	// Use default values from field.config or fallback to defaults
	const max_size_mb = $derived(field.config?.maxSizeMB ?? 1)
	const max_width_or_height = $derived(field.config?.maxWidthOrHeight ?? 1920)

	function update_config(updates) {
		const next = { ...(field.config || {}), ...updates }
		dispatch('input', { config: next })
	}
</script>

<div class="ImageFieldOptions">
	<div class="option-group">
		<UI.TextInput
			type="number"
			label="Max Size (MB)"
			value={max_size_mb}
			oninput={(value) => update_config({ maxSizeMB: Number(value) })}
		/>
	</div>
	<div class="option-group">
		<UI.TextInput
			type="number"
			label="Max Dimension (px)"
			value={max_width_or_height}
			oninput={(value) => update_config({ maxWidthOrHeight: Number(value) })}
		/>
	</div>
</div>

<style>
	.ImageFieldOptions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.option-group {
		flex: 1;
		min-width: 100px;
	}
</style>
