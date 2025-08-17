<script lang="ts">
	import type { Field } from '$lib/common/models/Field'
	import { type Entity } from '$lib/pocketbase/content'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from './Fields/FieldsContent.svelte'
	import EntryContent from './Fields/EntryContent.svelte'
	import { current_user } from '$lib/pocketbase/user'

	const { entity, fields, entries, oninput }: { entity: Entity; entries: Entry[]; fields: Field[]; oninput: FieldValueHandler } = $props()
</script>

<div class="Content">
	{#each fields as field (field.id)}
		<EntryContent {entity} {field} {fields} {entries} level={0} onchange={oninput} minimal={true} />
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
		gap: 1rem;
		padding-bottom: 0.5rem;
		/* padding-block: 0.5rem; */
		color: var(--color-gray-2);
		/* background: var(--primo-color-black); */
		height: 100%;
		overflow-y: auto;
		place-content: flex-start;
		justify-content: stretch;

		.empty-description {
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
