<script>
	import { page } from '$app/stores'
	import { fade } from 'svelte/transition'
	import ServerLogo from '$lib/components/ui/ServerLogo.svelte'

	let { form } = $props()

	let email = $state($page.url.searchParams.get('email') || '')
	let password = $state('')
	let password_again = $state('')
	let disabled = $derived(!password || !password_again || password !== password_again)

	const error = form?.error
</script>

<main in:fade class="primo-reset">
	<div class="logo">
		<div class="logo-container">
			<ServerLogo />
		</div>
	</div>
	<div class="box">
		<header>
			<h1>Create your account</h1>
			<h2>Enter the password you'll use for this account to finish signing up.</h2>
		</header>
		{#if error}
			<div class="error">{error}</div>
		{/if}
		<form class="form" method="POST">
			<div class="fields">
				<label>
					<span>Email</span>
					<input bind:value={email} type="email" disabled />
					<input value={email} type="hidden" name="email" />
				</label>
				<label>
					<span>Password</span>
					<input bind:value={password} type="password" name="email" />
				</label>
				<label>
					<span>Confirm Password</span>
					<input bind:value={password_again} type="password" name="password" />
				</label>
			</div>
			<footer>
				<button class="button" type="submit" {disabled} title={disabled ? 'Passwords do not match' : ''}>
					<span>Create account</span>
				</button>
			</footer>
		</form>
	</div>
</main>

<style lang="postcss">
	main {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 100vh;
		background: var(--color-gray-9);
		color: white;
	}
	.logo {
		display: flex;
		justify-content: center;
		width: 100%;
		margin-bottom: 2rem;

		.logo-container {
			width: 10rem;
		}
	}
	.error {
		color: #f72228;
		margin-bottom: 1rem;
	}
	header {
		padding-bottom: 10px;
		/* img {
      padding-bottom: 40px;
    } */
		h1 {
			text-align: left;
			font-weight: 500;
			font-size: 24px;
			line-height: 24px;
			padding-bottom: 0.5rem;
			/* --typography-spacing-vertical: 1rem; */
		}
		h2 {
			padding-bottom: 1rem;
			color: var(--color-gray-3);
		}
	}
	.box {
		width: 100%;
		max-width: 485px;
		padding: 2.5rem;
		border-radius: 6px;
		background-color: #1a1a1a;
		margin: 0 auto;
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
		}

		footer {
			display: grid;
			gap: 0.75rem;
			font-size: 0.785rem;
			color: var(--color-gray-3);

			a {
				text-decoration: underline;
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

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			&:hover {
				background-color: #70809e;
				transition: 0.2s;
				color: #121212;
			}

			&:focus {
				background-color: var(--weave-primary-color-dark);
			}
		}
	}
</style>
