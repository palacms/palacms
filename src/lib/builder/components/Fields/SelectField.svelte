<script lang="ts">
	import type { SelectField } from '$lib/common/models/fields/SelectField'
	import IconPicker from '../../components/IconPicker.svelte'
	import UI from '../../ui/index.js'
	import Icon from '@iconify/svelte'
	import { createEventDispatcher } from 'svelte'

	const { field }: { field: SelectField } = $props()
	const dispatch = createEventDispatcher()

	// Manage options separately since field.config keeps getting reset
	let options = $state(field.config?.options || [])

	function addOption() {
		options = [...options, { value: '', label: '', icon: '' }]
		dispatch('input', { config: { options } })
	}

	function validateFieldKey(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	// track focused value inputs to auto-fill values when unedited
	const clicked_value_inputs = new Set()
</script>

<!-- <div class="SelectField" style="margin-left: {1.5 + level}rem"> -->
<div class="SelectField">
	{#each options as option, i}
		<div class="select-field">
			<div class="option-icon">
				<span class="primo--field-label">Icon</span>
				<IconPicker
					variant="small"
					search_query={option.label}
					icon={option.icon || 'ri:checkbox-blank-circle-fill'}
					on:input={({ detail: icon }) => {
						option.icon = icon
						dispatch('input', { detail: { config: { options } } })
					}}
				/>
			</div>
			<UI.TextInput
				label="Option Label"
				value={option.label}
				autofocus={!option.label || option.label.length === 0}
				oninput={(text) => {
					option.value = clicked_value_inputs.has(i) ? option.value : validateFieldKey(text)
					option.label = text
					dispatch('input', { detail: { config: { options } } })
				}}
			/>
			<UI.TextInput
				label="Option Value"
				value={option.value}
				onfocus={() => clicked_value_inputs.add(i)}
				oninput={(text) => {
					option.value = text
					dispatch('input', { detail: { config: { options } } })
				}}
			/>
			<div class="item-options" id="repeater-{field.key}-{i}">
				{#if i !== 0}
					<button title="Move {field.label} up" onclick={() => {}}>
						<Icon icon="fa-solid:arrow-up" />
					</button>
				{/if}
				{#if i !== options.length - 1}
					<button title="Move {field.label} down" onclick={() => {}}>
						<Icon icon="fa-solid:arrow-down" />
					</button>
				{/if}
				<button style="color: var(--primo-color-danger)" title="Delete {field.label} item" onclick={() => {}}>
					<Icon icon="ion:trash" />
				</button>
			</div>
		</div>
	{/each}
	<button class="field-button subfield-button" onclick={addOption}>
		<Icon icon="ic:baseline-plus" />
		Create Option
	</button>
</div>

<style lang="postcss">
	.SelectField {
		display: grid;
		gap: 1rem;
		/* margin-left: 1rem; */
	}
	.select-field {
		display: grid;
		grid-template-columns: auto 1fr 1fr auto;
		grid-gap: 1rem;
		gap: 0.5rem;
	}
	.option-icon {
		display: grid;
		align-items: flex-end;
	}
	.field-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		background: var(--color-gray-7);
		color: var(--color-gray-3);
		padding: 8px 0;
		border-bottom-right-radius: var(--primo-border-radius);
		border-bottom-left-radius: var(--primo-border-radius);
		transition: var(--transition-colors);
	}
	.field-button:hover {
		background: var(--color-gray-9);
	}
	.field-button.subfield-button {
		border-radius: 4px;
		/* margin-top: 8px;
		margin-bottom: 8px; */
		font-size: var(--font-size-1);
		background: var(--primo-color-codeblack);
		color: var(--color-gray-2);
		transition: var(--transition-colors);
		outline: 0;
	}
	.field-button.subfield-button:hover {
		background: var(--color-gray-8);
	}
	.field-button.subfield-button:focus {
		/* background: var(--color-gray-8); */
		border-color: var(--weave-primary-color);
		outline: 0;
	}
	.item-options {
		display: flex;
		align-items: center;
		margin-top: 15px; /* to align with inputs */
		justify-content: flex-end;
		/* gap: 0.25rem; */

		button {
			padding: 0.5rem 9px; /* align with inputs */
			transition: 0.1s;
			border-radius: var(--primo-border-radius);

			&:hover {
				background: var(--color-gray-8);
			}
		}
	}
</style>
