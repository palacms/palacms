<script lang="ts">
	import FieldItem from './FieldItem.svelte'
	import { cloneDeep } from 'lodash-es'
	import autosize from 'autosize'
	import { mod_key_held } from '../../stores/app/misc'
	import UI from '../../ui/index.js'
	import Icon from '@iconify/svelte'
	import Condition from './Condition.svelte'
	import PageField from './PageField.svelte'
	import SiteFieldField from './SiteFieldField.svelte'
	import PageFieldField from './PageFieldField.svelte'
	import PageListField from './PageListField.svelte'
	import SelectField from './SelectField.svelte'
	import ImageFieldOptions from './ImageFieldOptions.svelte'
	import fieldTypes from '../../stores/app/fieldTypes.js'
	import { dynamic_field_types } from '$lib/builder/field-types'
	import { site_context, hide_dynamic_field_types_context, hide_page_field_field_type_context } from '$lib/builder/stores/context'
	import type { Field } from '$lib/common/models/Field'
	import { Sites } from '$lib/pocketbase/collections'
	import pluralize from 'pluralize'
	import { get_empty_value } from '../../utils.js'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'

	let {
		field,
		fields,
		level = 0,
		top_level = true,
		create_field,
		onchange,
		onduplicate,
		ondelete,
		onmove
	}: {
		field: Field
		fields: Field[]
		level?: number
		top_level?: boolean
		create_field?: (data?: Partial<Field>) => void
		onchange: (details: { id: string; data: Partial<Field> }) => void
		onduplicate: (id: string) => void
		ondelete: (id: string) => void
		onmove: (id: string, direction: 'up' | 'down') => void
	} = $props()

	const site = site_context.get()
	const page_types = $derived(site?.page_types() ?? [])

	const visible_field_types = hide_dynamic_field_types_context.getOr(false)
		? $fieldTypes.filter((ft) => !dynamic_field_types.includes(ft.id))
		: hide_page_field_field_type_context.getOr(false)
			? $fieldTypes.filter((ft) => ft.id !== 'page-field')
			: $fieldTypes

	let comparable_fields = $derived(
		fields
			.filter((f) => {
				const is_valid_type = ['text', 'number', 'switch', 'url', 'select'].includes(f.type)
				const same_parent = (!f.parent && !field.parent) || f.parent === field.parent
				const is_previous_sibling = same_parent && (f.index || 0) < (field.index || 0)
				return is_valid_type && is_previous_sibling
			})
			.sort((a, b) => (a.index || 0) - (b.index || 0))
	)

	function validate_field_key(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	// Auto-fill key when setting label
	let key_edited = $state(false)

	// autosize info textarea
	let info_textarea
	$effect(() => {
		if (info_textarea) {
			autosize(info_textarea)
		}
	})

	let width = $state<number>()
	let collapsed = $state(false)
	$effect(() => {
		if (!width) {
			return
		} else if (width < 400 && !collapsed) {
			collapsed = true
		} else if (width > 500 && collapsed) {
			collapsed = false
		}
	})

	let minimal = $derived(field.type === 'info')
	let has_subfields = $derived(field.type === 'group' || field.type === 'repeater')
	let has_condition = $derived(!!field.config?.condition)

	// enable condition if field has previous siblings without their own condition
	let condition_enabled = $derived(comparable_fields.length > 0)

	let selected_field_type_id = $state<string>()
	$effect.pre(() => {
		selected_field_type_id = visible_field_types.find((ft) => ft.id === field.type)?.id
	})

	// auto-match field-type to entered label (enhanced pattern matching)
	let field_type_changed = $state(false) // but don't overwrite it if the user's already entered it
	function update_field_type(label) {
		if (!label) return 'text'

		const labelLower = label.toLowerCase()
		const keyLower = field.key?.toLowerCase() || ''
		const combined = `${labelLower} ${keyLower}`

		// Plurals/Arrays first (most specific)
		if (label && pluralize.isPlural(label)) {
			return 'repeater'
		}

		// URL/Link patterns
		if (/\b(url|href|website|domain)\b/.test(combined)) return 'url'
		if (/\b(link)\b/.test(combined)) return 'link'

		// Image patterns
		if (/\b(image|img|photo|picture|avatar|banner|logo)\b/.test(combined)) return 'image'

		// Icon patterns
		if (/\b(icon|emoji)\b/.test(combined)) return 'icon'

		// Number patterns
		if (/\b(number|num|count|quantity|amount|price|cost|age|weight|height|width)\b/.test(combined)) return 'number'

		// Slider patterns (ranges, ratings, percentages)
		if (/\b(rating|range|percent|score|level|opacity|volume)\b/.test(combined)) return 'slider'

		// Boolean/Toggle patterns
		if (/\b(is|has|show|hide|enable|disable|active|visible|featured|toggle)\b/.test(combined)) return 'switch'

		// Select/Choice patterns
		if (/\b(type|category|status|state|option|choice|select)\b/.test(combined)) return 'select'

		// Group patterns (sections, groups)
		if (/\b(group|section|block|area)\b/.test(combined)) return 'group'

		// Page patterns
		if (/\b(page|pages)\b/.test(combined)) {
			return /\b(list|multiple)\b/.test(combined) ? 'page-list' : 'page'
		}

		// Site field patterns
		if (/\b(site|global|config|setting)\b/.test(combined)) return 'site-field'

		// Page field patterns
		if (/\b(page-field|page-content)\b/.test(combined)) return 'page-field'

		// Markdown patterns
		if (/\b(markdown|md|rich|formatted|wysiwyg|content|body|description|bio|about|summary|details)\b/.test(combined)) {
			return /\b(markdown|md)\b/.test(combined) ? 'markdown' : 'text'
		}

		// Info/Help patterns
		if (/\b(info|help|note|tip|instruction)\b/.test(combined)) return 'info'

		// Default to text
		return 'text'
	}

	function add_condition() {
		const default_field = comparable_fields[0]
		if (!default_field) {
			return
		}

		onchange({
			id: field.id,
			data: {
				config: {
					...field.config,
					condition: {
						field: default_field.id,
						comparison: '=',
						value: get_empty_value(default_field)
					}
				}
			}
		})
	}

	let child_fields = $derived(fields?.filter((f) => f.parent === field.id) || [])

	let is_new_field = $state(field.key === '')

	let hide_footer = $derived(!['select', 'image', ...dynamic_field_types].includes(field.type) && !field.config?.condition)
</script>

<div class="top-container" class:top_level class:collapsed>
	<div class="field-container" class:minimal bind:clientWidth={width}>
		<div class="type column-container">
			<UI.Select
				label="Type"
				value={selected_field_type_id}
				options={visible_field_types.map((ft) => ({
					icon: ft.icon,
					value: ft.id,
					label: ft.label
				}))}
				dividers={(() => {
					return hide_dynamic_field_types_context.getOr(false) ? [1, 8] : hide_page_field_field_type_context.getOr(false) ? [1, 8, 9, 11] : [1, 8, 10, 12]
				})()}
				on:input={({ detail: field_type_id }) => {
					field_type_changed = true
					selected_field_type_id = field_type_id

					// Set default config based on field type
					let defaultConfig = {}
					if (field_type_id === 'page') {
						// Page field requires page_type - get the first available page type
						const firstPageType = page_types[0]?.id || 'default'
						defaultConfig = { page_type: firstPageType }
					} else if (field_type_id === 'page-list') {
						// Page list might also need page_type
						const firstPageType = page_types[0]?.id || 'default'
						defaultConfig = { page_type: firstPageType }
					}

					onchange({ id: field.id, data: { type: field_type_id, config: defaultConfig } })
				}}
				placement="bottom-start"
			/>
			{#if collapsed}
				<div class="field-options">
					{#if $mod_key_held}
						<button onclick={add_condition}>
							<Icon icon="mdi:show" />
						</button>
						<button onclick={() => onduplicate(field.id)}>
							<Icon icon="bxs:duplicate" />
						</button>
						<button class="delete" onclick={() => ondelete(field.id)}>
							<Icon icon="ic:outline-delete" />
						</button>
					{:else}
						<UI.Dropdown
							size="lg"
							options={[
								{
									label: 'Move up',
									icon: 'material-symbols:arrow-circle-up-outline',
									on_click: () => onmove(field.id, 'up')
								},
								{
									label: 'Move down',
									icon: 'material-symbols:arrow-circle-down-outline',
									on_click: () => onmove(field.id, 'down')
								},
								...(has_condition
									? []
									: [
											{
												label: 'Set condition',
												icon: 'mdi:hide',
												disabled: !condition_enabled,
												on_click: () => {
													add_condition()
												}
											}
										]),
								{
									label: 'Duplicate',
									icon: 'bxs:duplicate',
									on_click: () => onduplicate(field.id)
								},
								{
									label: 'Delete',
									icon: 'ic:outline-delete',
									is_danger: true,
									on_click: () => ondelete(field.id)
								}
							]}
							placement="bottom-end"
						/>
					{/if}
				</div>
			{/if}
		</div>
		{#if minimal}
			<!-- Just for info field -->
			<div class="main column-container">
				<UI.TextInput
					label="Information"
					value={field.config?.info || ''}
					autogrow={true}
					placeholder="Something important about the following fields..."
					oninput={(text) => {
						onchange({
							id: field.id,
							data: {
								config: {
									...field.config,
									info: text
								}
							}
						})
					}}
				/>
				{#if !collapsed}
					<div class="field-options">
						{#if $mod_key_held}
							<button onclick={add_condition}>
								<Icon icon="mdi:show" />
							</button>
							<button onclick={() => onduplicate(field.id)}>
								<Icon icon="bxs:duplicate" />
							</button>
							<button class="delete" onclick={() => ondelete(field.id)}>
								<Icon icon="ic:outline-delete" />
							</button>
						{:else}
							<UI.Dropdown
								size="lg"
								options={[
									{
										label: 'Move up',
										icon: 'material-symbols:arrow-circle-up-outline',
										on_click: () => onmove(field.id, 'up')
									},
									{
										label: 'Move down',
										icon: 'material-symbols:arrow-circle-down-outline',
										on_click: () => onmove(field.id, 'down')
									},
									...(has_condition
										? []
										: [
												{
													label: 'Add Condition',
													icon: 'mdi:show',
													disabled: !condition_enabled,
													on_click: () => {
														add_condition()
													}
												}
											]),
									{
										label: 'Duplicate',
										icon: 'bxs:duplicate',
										on_click: () => onduplicate(field.id)
									},
									{
										label: 'Delete',
										icon: 'ic:outline-delete',
										is_danger: true,
										on_click: () => ondelete(field.id)
									}
								]}
								placement="bottom-end"
							/>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<div class="column-container">
				<UI.TextInput
					label="Label"
					value={field.label}
					placeholder="Heading"
					autofocus={is_new_field}
					on:keydown
					oninput={(text) => {
						// Auto-generate key unless user has manually edited it
						// Auto-suggest type only for new fields with empty initial label
						onchange({
							id: field.id,
							data: {
								label: text,
								key: key_edited ? field.key : validate_field_key(text),
								type: field.type
							}
						})

						// Mark as no longer new once user types something substantial
						if (text.length > 0) {
							is_new_field = false
						}
					}}
				/>
			</div>
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<div class="column-container">
				<UI.TextInput
					label="Key"
					placeholder="heading"
					value={field.key}
					on:keydown
					oninput={(text) => {
						key_edited = true
						onchange({
							id: field.id,
							data: {
								key: validate_field_key(text)
							}
						})
					}}
				/>
				{#if !collapsed}
					<div class="field-options">
						{#if $mod_key_held}
							<button onclick={add_condition}>
								<Icon icon="mdi:show" />
							</button>
							<button onclick={() => onduplicate(field.id)}>
								<Icon icon="bxs:duplicate" />
							</button>
							<button class="delete" onclick={() => ondelete(field.id)}>
								<Icon icon="ic:outline-delete" />
							</button>
						{:else}
							<UI.Dropdown
								size="lg"
								options={[
									{
										label: 'Move up',
										icon: 'material-symbols:arrow-circle-up-outline',
										on_click: () => onmove(field.id, 'up')
									},
									{
										label: 'Move down',
										icon: 'material-symbols:arrow-circle-down-outline',
										on_click: () => onmove(field.id, 'down')
									},
									...(has_condition
										? []
										: [
												{
													label: 'Add Condition',
													icon: 'mdi:show',
													disabled: !condition_enabled,
													on_click: () => {
														add_condition()
													}
												}
											]),
									{
										label: 'Duplicate',
										icon: 'bxs:duplicate',
										on_click: () => onduplicate(field.id)
									},
									{
										label: 'Delete',
										icon: 'ic:outline-delete',
										is_danger: true,
										on_click: () => ondelete(field.id)
									}
								]}
								placement="bottom-end"
							/>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
	<div class="footer" class:hidden={hide_footer}>
		{#if field.type === 'select'}
			<SelectField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'image'}
			<ImageFieldOptions
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'page-field'}
			<PageFieldField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'site-field'}
			<SiteFieldField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'page'}
			<PageField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'page-list'}
			<PageListField {field} />
		{/if}
		{#if field.config?.condition}
			<Condition
				{field}
				field_to_compare={fields.find((f) => f.id === field.config?.condition.field)}
				{comparable_fields}
				{collapsed}
				on:input={({ detail: condition }) => {
					onchange({
						id: field.id,
						data: {
							config: { ...field.config, condition }
						}
					})
				}}
			/>
		{/if}
	</div>

	{#if has_subfields}
		<div class="children-container" style:padding-left="{level + 1}rem">
			{#each child_fields.sort((a, b) => a.index - b.index) as subfield (subfield.id)}
				<FieldItem field={cloneDeep(subfield)} {fields} {create_field} top_level={false} level={level + 1} {onduplicate} {ondelete} {onmove} {onchange} />
			{/each}
			{#if field.type === 'repeater' || field.type === 'group'}
				<button
					class="subfield-button"
					data-level={level}
					onclick={() => {
						if (create_field) {
							create_field({ parent: field.id })
						}
					}}
				>
					<Icon icon="fa-solid:plus" />
					<span>Create {field.label} Subfield</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style lang="postcss">
	.hidden {
		display: none !important;
	}
	.top-container {
		display: grid;
		gap: 1rem;
		position: relative;

		&.top_level {
			background-color: #1a1a1a;
			padding: 1rem;
			/* border-radius: 6px; */
			/* padding: 24px 24px; */
		}

		&.collapsed {
			padding: 0.5rem;

			.field-container {
				grid-template-columns: 1fr !important;
				gap: 0.75rem;
			}
		}
	}
	.footer {
		display: grid;
		gap: 1rem;
		/* margin-left: 1rem; */
		border-top: 1px solid var(--color-gray-9);
		/* padding-top: 1rem; */
		padding-top: 0.5rem;
		margin-left: 1rem;

		&:empty {
			display: none;
		}
	}
	.field-options {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem; /* line up with inputs */

		button {
			font-size: 15px;
			padding: 0.5rem;
			border-radius: 0.25rem;
			transition: 0.1s;

			&:hover {
				background: var(--color-gray-8);
			}
		}

		button.delete {
			color: var(--primo-color-danger);
			&:hover {
				color: white;
				background: var(--primo-color-danger);
			}
		}
	}
	.subfield-button {
		width: 100%;
		border-radius: 0.25rem;
		/* margin-top: 10px; */
		padding: 0.5rem 1rem;
		font-size: var(--font-size-1);
		/* background: var(--primo-color-codeblack); */
		background: #292929;
		color: var(--button-color);
		/* background-color: #292929; */
		/* color: var(--color-gray-2); */
		transition: var(--transition-colors);
		outline: 0;
		display: block;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid transparent;

		&:hover {
			/* background: #333333; */
			background: #292929;
		}

		&:focus-visible {
			border-color: var(--weave-primary-color);
			outline: 0;
		}
	}

	.children-container {
		display: grid;
		gap: 1rem;
		/* margin: 1rem 0; */
		border-color: var(--color-gray-8);
	}

	.column-container {
		display: flex;
		/* flex-direction: column; */
		flex: 1;
		gap: 0.5rem;
	}

	.field-container {
		display: grid;
		grid-template-columns: minmax(150px, 1fr) 3fr 3fr;
		gap: 0.5rem;
		place-items: start normal;

		.type {
			border-radius: 1px;
			display: flex;
			min-width: 3rem;
		}

		&.minimal {
			grid-template-columns: auto 1fr auto;
		}
	}
</style>
