<script lang="ts" module>
	/**
	 * Map of field key to object keyed by index specifying value and optionally sub-values.
	 */
	export type FieldValueMap = Record<string, Record<number, { value: unknown; subValues?: FieldValueMap }>>

	/**
	 * Handler used when reporting change of field value.
	 */
	export type FieldValueHandler = (values: FieldValueMap) => void

	export function setFieldEntries(options: {
		fields?: Field[]
		entries?: Entry[]
		updateEntry: (id: string, data: Partial<Entry>) => Entry
		createEntry: (data: Omit<Entry, 'id'>) => Entry
		values: FieldValueMap
		parent?: Entry
	}) {
		const { fields, entries, updateEntry, createEntry, values, parent } = options
		for (const [key, items] of Object.entries(values)) {
			for (const index in items) {
				const field = fields?.find((field) => field.key === key && (parent ? field.parent === parent?.field : !field.parent))
				if (!field) {
					continue
				}

				let entry = entries?.find((entry) => entry.field === field?.id && (parent ? entry.parent === parent?.id : !entry.parent) && entry.index === +index)
				if (entry) {
					entry = updateEntry(entry.id, { value: items[index].value })
				} else {
					entry = createEntry({ field: field.id, parent: parent?.id, index: +index, locale: 'en', value: items[index].value })
				}

				if (items[index].subValues) {
					setFieldEntries({ ...options, values: items[index].subValues, parent: entry })
				}
			}
		}
	}
</script>

<script lang="ts">
	import Icon from '@iconify/svelte'
	import * as _ from 'lodash-es'
	import FieldItem from './FieldItem.svelte'
	import { fieldTypes } from '../../stores/app/index.js'
	import { mod_key_held } from '../../stores/app/misc.js'
	import type { Field } from '$lib/common/models/Field'
	import type { Entity } from '$lib/pocketbase/content'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Component } from 'svelte'
	import EntryContent from './EntryContent.svelte'
	import { current_user } from '$lib/pocketbase/user'

	let {
		entity,
		fields,
		entries,
		create_field,
		oninput,
		onchange,
		ondelete
	}: {
		entity: Entity
		fields: Field[]
		entries: Entry[]
		create_field: (data?: Partial<Field>) => void
		oninput: FieldValueHandler
		onchange: (details: { id: string; data: Partial<Field> }) => void
		ondelete: (field_id: string) => void
	} = $props()

	function get_component(field: Field) {
		const fieldType = $fieldTypes.find((ft) => ft.id === field.type)
		if (fieldType) {
			return fieldType.component as Component<{
				entity: Entity
				field: Field
				entry?: Entry
				fields: Field[]
				entries: Entry[]
				onchange: FieldValueHandler
				level: number
			}>
		} else {
			console.warn(`Field type '${field.type}' no longer exists, removing '${field.label}' field`)
			return null
		}
	}

	// TABS
	let selected_tabs = $state<Record<string, 'field' | 'entry'>>(Object.fromEntries(fields.map((f) => [f.id, f.key === '' ? 'field' : 'entry'])))

	function select_tab(field_id, tab) {
		selected_tabs[field_id] = tab
	}
	function set_all_tabs(tab) {
		Object.keys(selected_tabs).forEach((field_id) => {
			selected_tabs[field_id] = tab
		})
	}
	// Field reordering function
	function move_field(field: Field, direction: 'up' | 'down') {
		// Get all top-level fields (same parent level as the field being moved)
		const siblings = fields.filter((f) => (f.parent || '') === (field.parent || ''))

		// Sort by index to get current order
		const sorted_siblings = siblings.sort((a, b) => (a.index || 0) - (b.index || 0))

		// Find current position
		const current_index = sorted_siblings.findIndex((f) => f.id === field.id)

		if (current_index === -1) return // Field not found

		// Calculate new position
		let new_index = current_index
		if (direction === 'up' && current_index > 0) {
			new_index = current_index - 1
		} else if (direction === 'down' && current_index < sorted_siblings.length - 1) {
			new_index = current_index + 1
		} else {
			return // Can't move further in that direction
		}

		// Swap the fields - use the other field's current index value
		const field_to_swap = sorted_siblings[new_index]
		const temp_index = field.index || current_index

		// Update the indices by swapping them
		onchange({ id: field.id, data: { index: field_to_swap.index || new_index } })
		onchange({ id: field_to_swap.id, data: { index: temp_index } })
	}

	function duplicate_field(field: Field) {
		create_field(field)
	}

	// TODO: Implement
	// get(`active-tabs--${id}`).then((saved) => {
	// 	if (saved) {
	// 		Object.keys(saved).forEach((field_id) => {
	// 			const saved_tab = saved[field_id]
	// 			selected_tabs[field_id] = ['field', 'entry'].includes(saved_tab) ? saved_tab : 'entry'
	// 		})
	// 	}
	// })
</script>

<div class="Fields">
	{#each (fields || []).filter((f) => !f.parent || f.parent === '').sort((a, b) => a.index - b.index) as field (field.id)}
		{@const active_tab = selected_tabs[field.id] || 'field'}
		<div class="entries-item">
			<!-- TODO: hotkeys for tab switching  -->
			{#if $current_user?.siteRole === 'developer'}
				<div class="top-tabs">
					<button
						data-test-id="field"
						class:active={active_tab === 'field'}
						disabled={active_tab === 'field'}
						onclick={() => {
							if ($mod_key_held) {
								set_all_tabs('field')
							} else {
								select_tab(field.id, 'field')
							}
						}}
					>
						<Icon icon="fluent:form-48-filled" />
						<span>Field</span>
					</button>
					<button
						data-test-id="entry"
						style="border-top: 1px solid var(--color-gray-9);"
						class:active={active_tab === 'entry'}
						disabled={active_tab === 'entry'}
						onclick={() => {
							if ($mod_key_held) {
								set_all_tabs('entry')
							} else {
								select_tab(field.id, 'entry')
							}
						}}
					>
						{#if field.type === 'repeater'}
							<span>Entries</span>
						{:else}
							<span>Entry</span>
						{/if}
					</button>
				</div>
			{/if}
			<div class="container">
				{#if active_tab === 'field'}
					<div class="FieldItem">
						<FieldItem
							{field}
							{fields}
							{create_field}
							{onchange}
							{ondelete}
							onduplicate={() => {
								duplicate_field(field)
							}}
							onmove={(direction) => {
								move_field(field, direction)
							}}
						/>
					</div>
				{:else if active_tab === 'entry'}
					<EntryContent {entity} {field} {fields} {entries} level={0} onchange={oninput} />
				{/if}
			</div>
		</div>
	{/each}
	{#if $current_user?.siteRole === 'developer'}
		<button class="field-button" onclick={() => create_field()}>
			<div class="icon">
				<Icon icon="fa-solid:plus" />
			</div>
			<span>Create Field</span>
		</button>
	{/if}
</div>

<style lang="postcss">
	.Fields {
		width: 100%;
		display: grid;
		gap: 1rem;
		/* padding-top: 0.5rem; */
		padding-bottom: 1rem;
		/* padding-right: 10px; */
		color: var(--color-gray-2);
		height: 100%;
		overflow-y: auto;
		place-content: flex-start;
		justify-content: stretch;
	}
	.entries-item {
		display: grid;
		background: #1a1a1a;
		border-radius: 0.5rem;
		/* grid-template-columns: 1fr auto; */

		.container {
			border-bottom-left-radius: var(--primo-border-radius);
			border-bottom-right-radius: var(--primo-border-radius);
			overflow: hidden;
		}
		.top-tabs {
			display: grid;
			grid-template-columns: 1fr 1fr;
			button {
				background: #111;
				transition: 0.1s;
				opacity: 0.5;
				padding: 0.5rem;
				border-bottom: 1px solid var(--color-gray-9);
				display: flex;
				justify-content: center;
				align-items: center;
				gap: 0.5rem;
				font-size: 0.75rem;
			}

			button[disabled] {
				cursor: initial;
			}

			button:hover {
				opacity: 0.6;
			}

			button:first-child {
				border-top-left-radius: var(--primo-border-radius);
			}

			button:last-child {
				border-top-right-radius: var(--primo-border-radius);
			}

			button.active {
				background: transparent;
				color: var(--color-gray-2);
				opacity: 1;
			}
		}
	}
	.field-button {
		width: 100%;
		/* background: #292929; */
		background: var(--primo-color-codeblack);
		color: var(--button-color);
		transition:
			background 0.1s,
			color 0.1s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		/* font-size: 0.875rem; */
		font-size: var(--font-size-1);
		padding: 0.375rem;
		border-radius: 4px;
		font-weight: 400;
		border: 1px solid transparent;
		transition: 0.1s;

		&:hover {
			/* background: #333333; */
			background: #292929;
		}

		&:focus {
			border-color: var(--weave-primary-color);
		}
		&:focus-visible {
			outline: 0;
		}
	}
</style>
