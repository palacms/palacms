<script>
	import { onDestroy } from 'svelte'
	import Icon from '@iconify/svelte'
	import { get, set } from 'idb-keyval'
	import * as Avatar from '$lib/components/ui/avatar/index.js'

	/**
	 * @typedef {Object} Props
	 * @property {any} [id]
	 * @property {any} [title]
	 * @property {boolean} [minimal]
	 * @property {string} [icon]
	 * @property {any} [pill]
	 * @property {import('svelte').Snippet} [body]
	 * @property {import('svelte').Snippet} [children]
	 * @property {import('svelte').Snippet<[any]>} [footer]
	 */

	/** @type {Props} */
	let { id = null, title = null, minimal = false, icon = '', pill = null, body, children, footer } = $props()

	let hidden = $state(false)

	$effect.pre(() => {
		if (title)
			get(title).then((res) => {
				if (res !== undefined) {
					hidden = res
				}
			})
	})

	onDestroy(() => {
		if (title) {
			set(title, hidden)
		}
	})
</script>

<div class="Card" {id} class:minimal>
	<div class="absolute z-10 p-1 right-0 top-0 rounded-bl-lg flex justify-center -space-x-1">
		{#each [{ page: { name: 'About', slug: 'about', page_type: { name: 'Default', icon: 'iconoir:page' } }, user: { avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1287', name: 'Matthew Morris' } }, { page_type: { id: 'thepagetypeid', name: 'Blog Post', icon: 'flowbite:newspaper-outline' }, user: { avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8ZmFjZXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&q=60&w=900', name: 'Jesse' } }, { symbol: { name: 'Hero' }, user: { avatar: 'https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGZhY2V8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&q=60&w=900', name: 'Bryan' } }] as { user }}
			<Avatar.Root class="ring-background transition-all ring-2 size-4">
				<Avatar.Image src={user.avatar} alt={user.name} class="object-cover object-center" />
				<Avatar.Fallback>MM</Avatar.Fallback>
			</Avatar.Root>
		{/each}
	</div>
	<div>
		{#if title}
			<button
				class="header-button"
				onclick={() => {
					hidden = !hidden
				}}
			>
				<header>
					<div
						style="display: flex;
				align-items: center;
				gap: 0.5rem;"
					>
						{#if title}<span class="title">{title}</span>{/if}
						{#if icon}<Icon {icon} />{/if}
						{#if pill}
							<span class="pill">{pill}</span>
						{/if}
					</div>
					{#if hidden}
						<Icon icon="ph:caret-down-bold" />
					{:else}
						<Icon icon="ph:caret-up-bold" />
					{/if}
				</header>
			</button>
		{/if}
		{#if !hidden}
			<!-- <div class="card-body" transition:fade|local={{ duration: 100 }}> -->
			<div class="card-body">
				{@render body?.()}
				{@render children?.()}
			</div>
		{/if}
		{@render footer?.({ class: 'card-footer' })}
	</div>
</div>

<style lang="postcss">
	.Card {
		background: #1a1a1a;
		display: grid;
		position: relative; /* for absolutelty positioned button in top right corner */
	}
	button.header-button {
		padding: 1rem;
		&:not(:only-child) {
			border-bottom: 1px solid var(--color-gray-9);
		}
	}
	.Card.minimal .card-body {
		margin: 0 !important;
	}
	button {
		width: 100%;
		padding: 1rem;

		& + .card-body {
			padding-top: 0.5rem;
		}
	}

	header {
		width: 100%;
		font-size: var(--label-font-size);
		/* padding: 1rem; */
		/* font-weight: var(--label-font-weight); */
		font-weight: 400;
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		font-weight: 500;
		align-items: center;
		gap: 1rem;

		.title {
			font-weight: 400;
			text-align: left;
		}

		.pill {
			background: #b6b6b6;
			border-radius: 100px;
			padding: 3px 7px;
			font-size: 12px;
			font-weight: 500;
			color: #121212;
			margin-left: 0.5rem;
		}
	}
	.card-body {
		/* margin: 1.5rem; */
		margin: 1rem;
		overflow-x: hidden; /* for richtext field */

		&:not(:only-child) {
			margin-top: 0;
		}
	}
</style>
