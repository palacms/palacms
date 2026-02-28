<script>
	import Icon from '@iconify/svelte'
	import { self } from '$lib/pocketbase/managers'
	import { toast } from 'svelte-sonner'

	let { site, onClose } = $props()

	let branch = $state('main')
	let stage = $state('INITIAL') // INITIAL, DEPLOYING, DEPLOYED, ERROR
	let error = $state(null)
	let deployUrl = $state('')

	async function handle_deploy() {
		stage = 'DEPLOYING'
		error = null
		try {
			const resp = await fetch(`${self.instance?.baseURL}/api/palacms/deploy/${site.id}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${self.instance?.authStore.token}`
				},
				body: JSON.stringify({ branch })
			})
			if (!resp.ok) {
				const data = await resp.json()
				throw new Error(data.message || 'Deployment failed')
			}
			const data = await resp.json()
			deployUrl = data.url
			stage = 'DEPLOYED'
			toast.success('Deployment started successfully')
		} catch (err) {
			console.error('Deploy error:', err)
			error = err instanceof Error ? err.message : 'Deployment failed'
			stage = 'ERROR'
			toast.error(error)
		}
	}
</script>

<div class="CFDeploy primo-reset">
	{#if stage === 'INITIAL' || stage === 'DEPLOYING'}
		<div class="container">
			<h3 class="title">Cloudflare Deployment</h3>
			<p class="description">
				Deploying <strong>{site.name}</strong>
				 to Cloudflare Pages.
			</p>

			<div class="form-group">
				<label for="branch">Branch</label>
				<input id="branch" type="text" bind:value={branch} placeholder="branch (e.g. main)" disabled={stage === 'DEPLOYING'} class="primo-input" />
			</div>

			<div class="buttons">
				<button class="primo-button" onclick={onClose} disabled={stage === 'DEPLOYING'}>
					<span>Cancel</span>
				</button>
				<button class="primo-button primary" onclick={handle_deploy} disabled={stage === 'DEPLOYING'}>
					<Icon icon={stage === 'DEPLOYING' ? 'line-md:loading-twotone-loop' : 'lucide:cloud'} />
					<span>{stage === 'DEPLOYING' ? 'Deploying...' : 'Start Deployment'}</span>
				</button>
			</div>
		</div>
	{:else if stage === 'DEPLOYED'}
		<div class="container text-center">
			<div class="success-icon">
				<Icon icon="lucide:check-circle" width="3rem" class="text-green-500" />
			</div>
			<h3 class="title">Deployment Started!</h3>
			<p class="description">Your deployment has been triggered. It might take a minute to go live.</p>
			{#if deployUrl}
				<div class="url-box">
					<a href={deployUrl} target="_blank" class="deploy-link">
						{deployUrl}
						<Icon icon="lucide:external-link" width=".85rem" />
					</a>
				</div>
			{/if}
			<div class="buttons justify-center mt-4">
				<button class="primo-button primary" onclick={onClose}>
					<span>Done</span>
				</button>
			</div>
		</div>
	{:else if stage === 'ERROR'}
		<div class="container">
			<h3 class="title">Deployment Failed</h3>
			<div class="error-box">
				<p class="error">{error}</p>
			</div>
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
	.CFDeploy.primo-reset {
		color: white;
		background: var(--primo-color-black, #0a0a0a);
		padding: 2rem;
		display: grid;
		gap: 1.5rem;
		width: 100%;
	}
	.container {
		display: grid;
		gap: 1rem;
	}
	.title {
		font-size: 1.25rem;
		font-weight: 600;
	}
	.description {
		font-size: 0.9rem;
		color: #aaa;
		line-height: 1.5;
	}
	.form-group {
		display: grid;
		gap: 0.5rem;
		margin: 1rem 0;
	}
	label {
		font-size: 0.8rem;
		font-weight: 500;
		color: #888;
	}
	.primo-input {
		background: #111;
		border: 1px solid #333;
		border-radius: 0.25rem;
		padding: 0.6rem;
		color: white;
		width: 100%;
		outline: none;
	}
	.primo-input:focus {
		border-color: var(--pala-primary-color, #4f46e5);
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.primo-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.2rem;
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 0.25rem;
		color: white;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}
	.primo-button:hover:not(:disabled) {
		background: #222;
		border-color: #444;
	}
	.primo-button.primary {
		background: var(--pala-primary-color, #4f46e5);
		border-color: var(--pala-primary-color, #4f46e5);
	}
	.primo-button.primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}
	.primo-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.error-box {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		padding: 1rem;
		border-radius: 0.25rem;
		color: #f87171;
	}
	.success-icon {
		margin-bottom: 1rem;
		display: flex;
		justify-content: center;
	}
	.url-box {
		background: #111;
		border: 1px solid #222;
		padding: 0.75rem;
		border-radius: 0.25rem;
		margin: 1rem 0;
		word-break: break-all;
	}
	.deploy-link {
		color: var(--pala-primary-color, #4f46e5);
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-weight: 500;
	}
	.deploy-link:hover {
		text-decoration: underline;
	}
	.text-center {
		text-align: center;
	}
</style>
