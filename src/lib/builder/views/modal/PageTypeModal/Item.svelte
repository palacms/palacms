<script lang="ts">
	import Icon from '@iconify/svelte'
	import { validate_url } from '$lib/builder/utilities'
	import PageForm from './PageTypeForm.svelte'
	import MenuPopup from '$lib/builder/ui/Dropdown.svelte'
	import type { PageType } from '$lib/common/models/PageType'
	import { Sites, PageTypes, manager } from '$lib/pocketbase/collections'
	import { page } from '$app/state'
	import { site_context } from '$lib/builder/stores/context'

	let { active, page_type }: { active: boolean; page_type: PageType } = $props()

	const { value: site } = site_context.get()

	let editing_page = $state(false)

	let creating_page = $state(false)
	let new_page_url = $state('')
	$effect(() => {
		new_page_url = validate_url(new_page_url)
	})

	const full_url = $derived(() => {
		const base_path = page.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
		return `${base_path}/page-type--${page_type.id}`
	})
</script>

{#if editing_page}
	<PageForm
		page={page_type}
		new_page_name={page_type.name}
		new_color={page_type.color}
		new_icon={page_type.icon}
		on:create={({ detail: modified_page }) => {
			editing_page = false
			Object.assign(page_type, modified_page)
		}}
	/>
{:else}
	<div class="Item">
		<span class="icon" style:background={page_type.color}>
			<Icon icon={page_type.icon} />
		</span>
		<div class="page-item-container" class:active>
			<div class="left">
				<a class="name" href={full_url()}>
					{page_type.name}
				</a>
			</div>
			<div class="options">
				<MenuPopup
					icon="carbon:overflow-menu-vertical"
					options={[
						{
							label: 'Change name/icon/color',
							icon: 'clarity:edit-solid',
							on_click: () => {
								editing_page = !editing_page
							}
						},
						...(page_type.name !== 'Default'
							? [
									{
										label: 'Delete Type & Instances',
										icon: 'fluent:delete-20-filled',
										on_click: () => {
											const confirm = window.confirm(`This will delete ALL pages of this page type. Continue?`)
											if (confirm) {
												// TODO: configuring deleting page type & instances
												// if (!site) return
												// delete site.data.entities.page_types[page_type.id]
											}
										}
									}
								]
							: [])
					]}
				/>
			</div>
		</div>
	</div>
{/if}

{#if creating_page}
	<div style="border-left: 0.5rem solid #111;">
		<PageForm
			page={page_type}
			on:create={({ detail: page }) => {
				if (!site) return
				creating_page = false
				PageTypes.create(page)
				manager.commit()
				// TODO: test & configure navigating to new page type
				// site.data.page_types.push(page)
				// const [created_page_type] = site.data.page_types.slice(-1)
				// goto(`/${site.id}/page-type--${created_page_type.id}`)
			}}
		/>
	</div>
{/if}

<style lang="postcss">
	.Item {
		display: grid;
		grid-template-columns: auto 1fr;
		border-radius: var(--primo-border-radius);
		overflow: hidden;
	}
	.icon {
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding-inline: 1rem;
	}
	.page-item-container {
		flex: 1;
		display: flex;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		background: #1a1a1a;
		/* border-top-left-radius: 0;
		border-bottom-left-radius: 0; */

		&.active a {
			color: var(--weave-primary-color);
			/* outline: 1px solid var(--weave-primary-color); */
		}

		.options {
			display: flex;
			gap: 0.75rem;
		}
	}

	.left {
		display: flex;
		align-items: center;
		gap: 0.75rem;

		a.name {
			border-bottom: 1px solid transparent;
			margin-bottom: -1px;
			transition: 0.1s;
			&:hover {
				border-color: white;
			}
		}

		.name {
			font-weight: 400;
			line-height: 1.5rem;
			display: flex;
			gap: 1rem;
			color: var(--color-gray-1);
		}
	}
</style>
