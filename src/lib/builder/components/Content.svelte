<script lang="ts">
	import type { Field } from '$lib/common/models/Field'
	import type { Entity } from '$lib/Content.svelte'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from './Fields/FieldsContent.svelte'
	import EntryContent from './Fields/EntryContent.svelte'
	import { current_user } from '$lib/pocketbase/user'

	const {
		entity,
		fields,
		entries,
		oninput,
		ondelete
	}: {
		entity: Entity
		entries: Entry[]
		fields: Field[]
		oninput: FieldValueHandler
		ondelete: (entry_id: string) => void
	} = $props()

	function delete_entry_related_records(entry_id: string) {
		// Delete all sub-entries.
		for (const entry of entries) {
			if (entry.parent === entry_id) {
				delete_entry_related_records(entry.id)
				ondelete(entry.id)
			}
		}
	}

	function handle_delete_entry(entry_id: string) {
		delete_entry_related_records(entry_id)
		ondelete(entry_id)
	}
</script>

<div class="Content">
	{#each fields.filter((f) => !f.parent) as field (field.id)}
		<EntryContent {entity} {field} {fields} {entries} level={0} onchange={oninput} ondelete={handle_delete_entry} />
	{:else}
		<p class="empty-description">
			{#if $current_user?.siteRole === 'developer'}
				When you create fields, they'll be editable from here
			{:else}
				When the site developer creates fields, they'll be editable from here
			{/if}
		</p>
	{/each}
</div>

<style lang="postcss">
	.Content {
		width: 100%;
		display: grid;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		/* padding-block: 0.5rem; */
		color: var(--color-gray-2);
		/* background: var(--primo-color-black); */
		height: 100%;
		overflow-y: auto;
		place-content: flex-start;
		justify-content: stretch;

		.empty-description {
			padding-inline: 0.5rem;
			color: var(--color-gray-4);
			font-size: var(--font-size-2);
			height: 100%;
			display: flex;
			align-items: flex-start;
			justify-content: center;
			margin-top: 12px;
		}
	}
</style>
