<script>
	import { PageTypes } from '$lib/pocketbase/collections'
	import Icon from '@iconify/svelte'

	let { field, value } = $props()

	const selected_page_type = $derived(PageTypes.one(field.config.page_type))
</script>

<div class="page-list">
	{#if selected_page_type}
		<span class="icon" style:background={selected_page_type.color}>
			<Icon icon={selected_page_type.icon} />
		</span>
		<span class="label">Page List</span>
	{:else}
		<div>No page connected</div>
	{/if}
</div>

<style lang="postcss">
	.page-list {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-gray-3);
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		padding: 0.375rem;
		border-radius: 0.375rem;
		background: var(--color-gray-9);
	}

	.label {
		font-weight: 500;
		color: var(--color-gray-1);
	}
</style>
