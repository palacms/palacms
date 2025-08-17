<script lang="ts">
	import { goto } from '$app/navigation'
	import { Users, manager } from '$lib/pocketbase/collections'
	import { Loader } from 'lucide-svelte'
	import ServerLogo from '$lib/components/ui/ServerLogo.svelte'
	import { self } from '$lib/pocketbase/PocketBase'
	import { page } from '$app/state'

	let current_step = $state(1)
	let email = $state('')
	let password = $state('')
	let confirm_password = $state('')
	let loading = $state(false)
	let navigating = $state(false)
	let checking_setup = $state(true)
	let error = $state('')
	const is_form_valid = $derived(email.trim() !== '' && password.length >= 8 && confirm_password !== '' && password === confirm_password)
	const token = $derived(page.url.hash.slice(1))
	const authOpts = $derived({ headers: { Authorization: token } })

	const users = self.collection('users')
	const superusers = self.collection('_superusers')

	// Check if setup is already complete and redirect if so
	$effect(() => {
		checking_setup = true
		error = ''

		if (!token) {
			error = 'Missing the access token. Is the URL correct?'
			return
		}

		superusers
			.getList(0, 0, { ...authOpts, filter: 'email != "__pbinstaller@example.com"' })
			.catch((err) => {
				error = 'Authentication failed! Is the URL correct? Setup URL is generated when starting up PalaCMS and is valid for 30 minutes.'
				throw err
			})
			.then(({ totalItems: userCount }) => {
				if (userCount > 0) {
					// Setup already complete
					error = 'Setup is already completed! Redirecting...'
					return goto('/admin', { replaceState: true })
				} else {
					checking_setup = false
				}
			})
			.catch((err) => {
				console.error('Setup failed:', err)
			})
	})

	const create_user = async (event: SubmitEvent) => {
		event.preventDefault()

		if (password !== confirm_password) {
			error = 'Passwords do not match'
			return
		}

		loading = true
		error = ''

		try {
			await users.create(
				{
					email,
					password,
					passwordConfirm: password,
					serverRole: 'developer'
				},
				authOpts
			)

			await superusers.create(
				{
					email,
					password,
					passwordConfirm: password
				},
				authOpts
			)

			// Authenticate the user immediately after creation
			try {
				await Users.authWithPassword(email, password)
				console.log('User authenticated successfully')
				console.log('Auth record:', Users.instance.authStore.record)
			} catch (authError) {
				console.warn('Could not authenticate user:', authError)
			}

			current_step = 2
		} catch (err: any) {
			console.error('User creation error:', err)

			// Extract specific field errors if available
			if (err.response?.data) {
				const fieldErrors = Object.entries(err.response.data)
					.map(([field, details]: [string, any]) => `${field}: ${details.message || details}`)
					.join(', ')
				error = fieldErrors || err.message || 'Failed to create user'
			} else {
				error = err.message || 'Failed to create user'
			}
		}
		loading = false
	}

	const complete_setup = () => {
		console.log('Completing setup, navigating to /admin/site')
		console.log('User authenticated:', Users.instance.authStore.isValid)
		navigating = true
		goto('/admin/site', { replaceState: true })
	}
</script>

<main class="primo-reset">
	<div class="left">
		<div class="box">
			<div class="logo">
				<div class="logo-container">
					<ServerLogo />
				</div>
			</div>
			<header>
				<h1>Welcome to Pala</h1>
				<p class="subtitle">Set up your CMS in 2 simple steps</p>
			</header>

			{#if checking_setup}
				{#if error}
					<div class="loading-container">
						<p class="error">{error}</p>
					</div>
				{:else}
					<div class="loading-container">
						<Loader class="animate-spin" />
						<p>Checking setup status...</p>
					</div>
				{/if}
			{:else}
				<div class="steps-indicator">
					<div class="step" class:active={current_step === 1} class:completed={current_step > 1}>
						<span>1</span>
						Create Admin User
					</div>
					<div class="step" class:active={current_step === 2}>
						<span>2</span>
						Database Access
					</div>
				</div>

				{#if error}
					<div class="error">{error}</div>
				{/if}

				{#if current_step === 1}
					<form class="form" onsubmit={create_user}>
						<div class="fields">
							<label>
								<span>Email</span>
								<input data-test-id="email" bind:value={email} type="email" name="email" required />
							</label>
							<label>
								<span>Password</span>
								<input data-test-id="password" bind:value={password} type="password" name="password" required minlength="8" />
							</label>
							<label>
								<span>Confirm Password</span>
								<input data-test-id="confirm-password" bind:value={confirm_password} type="password" name="confirm-password" required />
							</label>
						</div>
						<button class="button" type="submit" data-test-id="create-user" disabled={loading || !is_form_valid}>
							<span class:invisible={loading}>Create Admin User</span>
							{#if loading}
								<div class="animate-spin absolute">
									<Loader />
								</div>
							{/if}
						</button>
					</form>
				{:else if current_step === 2}
					<div class="step-content">
						<h2>Database Access</h2>

						<p>Database admin access has been set up with your admin credentials.</p>
						<div class="credentials-box">
							<div class="credential-item">
								<strong>Email:</strong>
								{email}
							</div>
							<div class="credential-item">
								<strong>Password:</strong>
								Same as your admin password
							</div>
							<div class="info">💡 You can change these credentials from the database admin interface</div>
							<a href="/_/" target="_blank" rel="noopener noreferrer" class="database-link">Open Database Admin</a>
						</div>

						<button class="button full-width" onclick={complete_setup} data-test-id="continue" disabled={navigating}>
							<span class:invisible={navigating}>Create First Site</span>
							{#if navigating}
								<div class="animate-spin absolute">
									<Loader />
								</div>
							{/if}
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</main>

<style lang="postcss">
	main {
		display: grid;
		min-height: 100vh;
		background: var(--color-gray-9);
		color: white;
	}
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		color: #b6b6b6;

		p {
			font-size: 14px;
			margin: 0;
		}
	}
	.logo {
		display: flex;
		justify-content: center;
		width: 100%;
		margin-bottom: 2rem;

		.logo-container {
			width: 8rem;
		}
	}
	.box {
		width: 100%;
		max-width: 500px;
		padding: 2.5rem;
		border-radius: 6px;
		background-color: #1a1a1a;
	}
	.left {
		padding: 3rem clamp(3rem, 10vw, 160px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	header {
		margin-bottom: 2rem;

		h1 {
			text-align: center;
			font-weight: 500;
			font-size: 28px;
			line-height: 32px;
			margin-bottom: 0.5rem;
		}

		.subtitle {
			text-align: center;
			color: #b6b6b6;
			font-size: 14px;
		}
	}
	.steps-indicator {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;

		.step {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			flex: 1;
			font-size: 14px;
			color: #6e6e6e;

			span {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				border-radius: 50%;
				background-color: #2a2a2a;
				font-size: 12px;
				font-weight: 500;
			}

			&.active {
				color: #70809e;

				span {
					background-color: #70809e;
					color: white;
				}
			}

			&.completed {
				color: #4ade80;

				span {
					background-color: #4ade80;
					color: white;
				}
			}
		}
	}
	.error {
		color: #f72228;
		margin-bottom: 1rem;
	}
	.form {
		display: grid;
		gap: 2rem;
		width: 100%;

		.fields {
			display: grid;
			gap: 1rem;
		}

		label {
			color: #b6b6b6;
			display: grid;
			gap: 0.5rem;
			font-size: 0.875rem;
			font-weight: 400;
		}

		input {
			color: #dadada;
			border-radius: 0.25rem;
			border: 1px solid #6e6e6e;
			padding: 0.75rem;
			background-color: #1c1c1c;
			font-size: 1rem;

			&:focus {
				outline: none;
				border-color: #70809e;
			}
		}

		.button {
			color: #cecece;
			font-weight: 500;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			padding: 0.65rem;
			border: 1.5px solid #70809e;
			border-radius: 0.25rem;
			position: relative;
			transition: 0.2s;

			&:not(:disabled):hover {
				background-color: #70809e;
				color: #121212;
			}

			&:disabled {
				opacity: 0.75;
				cursor: not-allowed;
				color: #6e6e6e !important;
				border-color: #444 !important;
				background-color: #2a2a2a !important;
				pointer-events: none;
			}

			.invisible {
				visibility: hidden;
			}

			@keyframes spin {
				from {
					transform: rotate(0deg);
				}
				to {
					transform: rotate(360deg);
				}
			}
		}
	}
	.step-content {
		text-align: center;

		h2 {
			font-size: 24px;
			font-weight: 500;
			margin-bottom: 1rem;
		}

		p {
			color: #b6b6b6;
			margin-bottom: 1rem;
			line-height: 1.5;
		}

		.instructions {
			font-size: 14px;
			color: #797979;
			margin-top: 1.5rem;
		}

		.credentials-box {
			background-color: #2a2a2a;
			border: 1px solid #444;
			border-radius: 8px;
			padding: 1rem;
			margin: 1.5rem 0;
			font-family: 'Fira Code', monospace;
			position: relative;

			.credential-item {
				margin-bottom: 0.5rem;
				font-size: 14px;

				strong {
					color: #70809e;
					margin-right: 0.5rem;
				}
			}

			.warning {
				margin-top: 1rem;
				padding: 0.5rem;
				background-color: #4a3728;
				border: 1px solid #8b6914;
				border-radius: 4px;
				color: #fbbf24;
				font-size: 12px;
				text-align: center;
			}

			.info {
				margin-top: 1rem;
				padding: 0.5rem;
				background-color: #1e3a4a;
				border: 1px solid #3b82f6;
				border-radius: 4px;
				color: #60a5fa;
				font-size: 12px;
				text-align: center;
			}
		}

		.database-link {
			font-size: 0.75rem;
			display: inline-block;
			margin-top: 1rem;
			color: #70809e;
			text-decoration: underline;

			&:hover {
				color: #5a6b7f;
			}
		}

		.button {
			color: #cecece;
			font-weight: 500;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			padding: 0.65rem 2rem;
			border: 1.5px solid #70809e;
			border-radius: 0.25rem;
			margin: 0 auto;
			min-width: 200px;

			&:hover {
				background-color: #70809e;
				transition: 0.2s;
				color: #121212;
			}

			&.full-width {
				width: 100%;
				margin: 0;
			}
		}
	}
</style>
