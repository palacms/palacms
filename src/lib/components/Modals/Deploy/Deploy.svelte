<script>
	import Icon from '@iconify/svelte'
	import { page } from '$app/state'
	import { PressedKeys } from 'runed'
	import { onModKey, isModKeyPressed } from '$lib/builder/utils/keyboard'

	let { stage = $bindable(), publish_fn, loading, site_host, onClose } = $props()

	let error = $state(null)

	async function handle_publish() {
		try {
			error = null
			await publish_fn()
			stage = 'PUBLISHED'
		} catch (err) {
			console.error('Publish error:', err)
			error = err.message || err.toString() || 'Failed to publish site'
			stage = 'ERROR'
		}
	}

	stage = stage || 'INITIAL'

	// Set up hotkey listener for Cmd+P to confirm publish
	const modalKeys = new PressedKeys()
	const modKeyHeld = $derived(isModKeyPressed(modalKeys))
	
	onModKey(modalKeys, 'p', () => {
		if (stage === 'INITIAL' && !loading) {
			handle_publish()
		}
	})
</script>

<div class="Deploy primo-reset">
	{#if stage === 'INITIAL'}
		<div class="container">
			<h3 class="title">Publish Site</h3>
			{#if site_host}
				<p class="description">
					Your website will be published to
					<a href="{page.url.protocol}//{site_host}" target="_blank">{site_host}</a>
				</p>
			{:else}
				<p class="description">Ready to publish your website changes?</p>
			{/if}
			<div class="buttons">
				<button class="primo-button" onclick={onClose}>
					<span>Cancel</span>
				</button>
				<button class="primo-button primary" onclick={handle_publish} disabled={loading}>
					<Icon icon={loading ? 'line-md:loading-twotone-loop' : 'entypo:publish'} class={modKeyHeld && !loading ? 'invisible' : ''} />
					<span class:invisible={modKeyHeld && !loading}>{loading ? 'Publishing...' : 'Publish Changes'}</span>
					{#if modKeyHeld && !loading}
						<span class="key-hint">⌘P</span>
					{/if}
				</button>
			</div>
		</div>
	{:else if stage === 'PUBLISHED'}
		<div class="container">
			<h3 class="title">Published Successfully!</h3>
			<p class="description">
				Your website changes have been published to
				{#if site_host}
					<a href="{page.url.protocol}//{site_host}" target="_blank">{site_host}</a>
				{:else}
					your live site
				{/if}
			</p>
			<div class="buttons">
				<button class="primo-button primary" onclick={onClose}>
					<span>Done</span>
				</button>
				{#if site_host}
					<a href="{page.url.protocol}//{site_host}" target="_blank" class="primo-button">
						<Icon icon="lucide:external-link" />
						<span>View Site</span>
					</a>
				{/if}
			</div>
		</div>
	{:else if stage === 'ERROR'}
		<div class="container">
			<h3 class="title">Publishing Failed</h3>
			<p class="error">{error}</p>
			<div class="buttons">
				<button class="primo-button" onclick={onClose}>
					<span>Close</span>
				</button>
				<button class="primo-button primary" onclick={() => (stage = 'INITIAL')}>
					<span>Try Again</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	.Deploy.primo-reset {
		color: white;
		background: var(--primo-color-black);
		padding: 3rem 1.25rem 1.125rem 1.25rem;
		display: grid;
		gap: 1rem;
		width: 100%;
	}
	.container {
		display: grid;
	}

	.title {
		font-size: 1.125rem;
		font-weight: 600;
		color: white;
	}

	.error {
		padding: 0.5rem;
		background: var(--primo-color-danger);
		border-radius: 0.25rem;
		margin: 0.5rem 0;
	}

	.description {
		margin-bottom: 2rem;
		line-height: 1.5;
		a {
			text-decoration: underline;
			color: #70809e;
		}
		a:hover {
			color: white;
		}
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
	}
	.primo-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 8px 16px;
		background: var(--primo-color-codeblack);
		border: 1px solid #333;
		border-radius: 0.25rem;
		color: white;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.2s;
	}
	.primo-button:hover {
		background: #333;
		border-color: #555;
	}
	.primo-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.primo-button.primary {
		background: var(--weave-primary-color, #4F46E5);
		border-color: var(--weave-primary-color, #4F46E5);
		position: relative;
	}
	.primo-button.primary:hover {
		background: var(--weave-primary-color-dark, #4338CA);
		border-color: var(--weave-primary-color-dark, #4338CA);
	}
	.key-hint {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		pointer-events: none;
	}
	.primo-button:disabled:hover {
		background: var(--primo-color-codeblack);
		border-color: #333;
	}
	.primo-button.primary {
		border: 1px solid #70809e;
		background: transparent;
	}
	.primo-button.primary:hover {
		background: #70809e;
		border-color: #70809e;
	}
	:global(form > label) {
		flex: 1;
	}
</style>
