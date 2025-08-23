<script>
	import UI from '../../ui/index.js'
	import { createEventDispatcher } from 'svelte'

	const dispatch = createEventDispatcher()

	let { field } = $props()

	// Initialize config object if it doesn't exist
	if (!field.config) field.config = {}

	// Listen for changes to dispatch updates to parent
	function handle_change() {
		dispatch('input', { config: field.config })
	}

	$effect(() => {
		// Set defaults if values don't exist
		if (field.config.maxSizeMB === undefined) {
			field.config.maxSizeMB = 1
			handle_change()
		}
		if (field.config.maxWidthOrHeight === undefined) {
			field.config.maxWidthOrHeight = 1920
			handle_change()
		}
	})
</script>

<div class="ImageFieldOptions">
	<div class="option-group">
		<UI.TextInput type="number" label="Max Size (MB)" bind:value={field.config.maxSizeMB} on:input={handle_change} />
	</div>
	<div class="option-group">
		<UI.TextInput type="number" label="Max Dimension (px)" bind:value={field.config.maxWidthOrHeight} on:input={handle_change} />
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
