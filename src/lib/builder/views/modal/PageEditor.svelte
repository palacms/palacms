<script lang="ts">
	import Icon from '@iconify/svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import Fields, { setFieldEntries } from '$lib/builder/components/Fields/FieldsContent.svelte'
	import * as _ from 'lodash-es'
	import CodeEditor from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import { manager, PageTypeEntries, PageTypeFields, PageTypes } from '$lib/pocketbase/collections'
	import { page_type_context } from '$lib/builder/stores/context'

	let { onClose }: { onClose?: () => void } = $props()

	const { value: page_type } = page_type_context.get()
	const fields = $derived(page_type?.fields() ?? [])
	const entries = $derived(page_type?.entries() ?? [])

	let head = $state('')
	let foot = $state('')
	$effect.pre(() => {
		if (page_type) {
			head = page_type.head
			foot = page_type.foot
		}
	})
	$effect(() => {})

	let disableSave = $state(false)

	async function saveComponent() {
		disableSave = true
		try {
			PageTypes.update(page_type_id, {
				head,
				foot
			})
			await manager.commit()
			if (onClose) onClose()
		} finally {
			disableSave = false
		}
	}
</script>

{#if page_type}
	<Dialog.Header
		class="mb-2"
		title={page_type.name}
		button={{
			onclick: saveComponent,
			label: 'Save',
			disabled: disableSave
		}}
	/>

	<main class="SiteEditor">
		<PaneGroup direction="horizontal" style="display: flex;">
			<Pane defaultSize={50}>
				<Fields
					entity={page_type}
					{fields}
					{entries}
					create_field={async (data) => {
						// Get the highest index for fields at this level
						const siblingFields = (fields ?? []).filter((f) => (data?.parent ? f.parent === data.parent : !f.parent))
						const nextIndex = Math.max(...siblingFields.map((f) => f.index || 0), -1) + 1

						PageTypeFields.create({
							type: 'text',
							key: '',
							label: '',
							config: null,
							page_type: page_type.id,
							...data,
							index: nextIndex
						})
					}}
					oninput={(values) => {
						setFieldEntries({
							fields,
							entries,
							updateEntry: PageTypeEntries.update,
							createEntry: PageTypeEntries.create,
							values
						})
					}}
					onchange={({ id, data }) => {
						PageTypeFields.update(id, data)
					}}
					ondelete={(field_id) => {
						PageTypeFields.delete(field_id)
					}}
					ondelete_entry={(entry_id) => {
						PageTypeEntries.delete(entry_id)
					}}
				/>
			</Pane>
			<PaneResizer class="PaneResizer-primary">
				<div class="icon primary">
					<Icon icon="mdi:drag-vertical-variant" />
				</div>
			</PaneResizer>
			<Pane defaultSize={50}>
				<PaneGroup direction="vertical">
					<Pane>
						<div class="container" style="margin-bottom: 1rem">
							<span class="primo--field-label">Head</span>
							<CodeEditor mode="html" bind:value={head} on:save={saveComponent} />
						</div>
					</Pane>
					<PaneResizer class="PaneResizer-secondary">
						<div class="icon secondary">
							<Icon icon="mdi:drag-horizontal-variant" />
						</div>
					</PaneResizer>
					<Pane>
						<div class="container">
							<span class="primo--field-label">Foot</span>
							<CodeEditor mode="html" bind:value={foot} on:save={saveComponent} />
						</div>
					</Pane>
				</PaneGroup>
			</Pane>
		</PaneGroup>
	</main>
{/if}

<style lang="postcss">
	.SiteEditor {
	}
	main {
		display: flex; /* to help w/ positioning child items in code view */
		background: var(--primo-color-black);
		color: var(--color-gray-2);
		padding: 0 0.5rem;
		flex: 1;
		overflow: hidden;

		--Button-bg: var(--color-gray-8);
		--Button-bg-hover: var(--color-gray-9);
	}

	:global(.PaneResizer-primary) {
		height: 100%;
		width: 3px;
		background: var(--color-gray-9);
		display: grid;
		place-content: center;
	}
	:global(.PaneResizer-secondary) {
		width: 100%;
		display: grid;
		place-content: center;
		justify-content: center;
		height: 2px;
		background: var(--color-gray-8);
		margin-block: 0.5rem;
	}
	.icon {
		position: relative;
		background: var(--color-gray-8);
		border-radius: 2px;
		color: var(--color-gray-3);

		&.primary {
			padding-block: 3px;
		}

		&.secondary {
			padding-inline: 3px;
		}
	}
	.container {
		padding-left: 0.75rem;
		display: flex;
		flex-direction: column;
		max-height: 100%;
	}
</style>
