<script>
	import Icon from '@iconify/svelte'
	import { self } from '$lib/pocketbase/managers'
	import { toast } from 'svelte-sonner'

	let { site, publish, onClose } = $props()

	let branch = $state('main')
	let stage = $state('CHECKING') // CHECKING, INITIAL, DEPLOYING, DEPLOYED, ERROR, NO_PREVIEW, OLD_PREVIEW, GENERATING
	let status = $state({ exists: false, isOutdated: false })
	let error = $state(null)
	let deployUrl = $state('')

	const previewUrl = $derived(`${self.instance?.baseURL}/?_site=${site.id}`)
	const targetUrl = $derived.by(() => {
		if (!site.cfProjectName) return ''
		if (branch === 'main') return `https://${site.cfProjectName}.pages.dev`
		return `https://${branch}.${site.cfProjectName}.pages.dev`
	})

	$effect(() => {
		check_status()
	})

	async function check_status() {
		try {
			const resp = await fetch(`${self.instance?.baseURL}/api/palacms/deploy-status/${site.id}`, {
				headers: {
					Authorization: `Bearer ${self.instance?.authStore.token}`
				}
			})
			if (!resp.ok) throw new Error('Failed to check status')
			status = await resp.json()

			if (!status.exists) {
				stage = 'NO_PREVIEW'
			} else if (status.isOutdated) {
				stage = 'OLD_PREVIEW'
			} else {
				stage = 'INITIAL'
			}
		} catch (err) {
			console.error('Status check error:', err)
			stage = 'INITIAL' // Fallback to initial if check fails
		}
	}

	async function handle_generate() {
		stage = 'GENERATING'
		try {
			await publish.run()
			await check_status()
			toast.success('Preview generated successfully')
		} catch (err) {
			console.error('Generate error:', err)
			toast.error('Failed to generate preview')
			stage = 'INITIAL'
		}
	}

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
			const errorMessage = err instanceof Error ? err.message : 'Deployment failed'
			error = errorMessage
			stage = 'ERROR'
			toast.error(errorMessage)
		}
	}
</script>

<div class="CFDeploy primo-reset">
	{#if stage === 'CHECKING'}
		<div class="container text-center py-8">
			<Icon icon="line-md:loading-twotone-loop" width="2rem" />
			<p>Checking preview status...</p>
		</div>
	{:else if stage === 'NO_PREVIEW'}
		<div class="container">
			<h3 class="title">Preview Required</h3>
			<div class="warning-box">
				<Icon icon="lucide:alert-triangle" />
				<p>No preview files found. You must generate a preview before deploying.</p>
			</div>
			<div class="buttons">
				<button class="primo-button" onclick={onClose}>Cancel</button>
				<button class="primo-button primary" onclick={handle_generate}>
					<Icon icon="lucide:play" />
					<span>Generate Preview</span>
				</button>
			</div>
		</div>
	{:else if stage === 'OLD_PREVIEW'}
		<div class="container">
			<h3 class="title">Outdated Preview</h3>
			<div class="warning-box">
				<Icon icon="lucide:alert-circle" />
				<p>The site has been updated since the last preview was generated. You might want to refresh the preview before deploying.</p>
			</div>
			<div class="buttons">
				<button class="primo-button" onclick={onClose}>Cancel</button>
				<button class="primo-button" onclick={() => (stage = 'INITIAL')}>
					<span>Deploy Anyway</span>
				</button>
				<button class="primo-button primary" onclick={handle_generate}>
					<Icon icon="lucide:refresh-cw" />
					<span>Generate Fresh Preview</span>
				</button>
			</div>
		</div>
	{:else if stage === 'GENERATING'}
		<div class="container text-center py-8">
			<Icon icon="line-md:loading-twotone-loop" width="2rem" />
			<p>Generating preview files...</p>
		</div>
	{:else if stage === 'INITIAL' || stage === 'DEPLOYING'}
		<div class="container">
			<h3 class="title">Cloudflare Deployment</h3>
			<p class="description">
				The current preview at
				<a href={previewUrl} target="_blank" class="text-blue-400 hover:underline">{previewUrl}</a>
				will be deployed to Cloudflare at
				<a href={targetUrl} target="_blank" class="text-blue-400 hover:underline">{targetUrl}</a>
				.
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
	.warning-box {
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.2);
		padding: 1rem;
		border-radius: 0.25rem;
		color: #fbbf24;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.warning-box p {
		margin: 0;
		font-size: 0.9rem;
	}
	.py-8 {
		padding-top: 2rem;
		padding-bottom: 2rem;
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
