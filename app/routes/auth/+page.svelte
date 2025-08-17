<script>
	import { page } from '$app/stores'
	import { fade } from 'svelte/transition'
	import AuthForm from './AuthForm.svelte'
	import ServerLogo from '$lib/components/ui/ServerLogo.svelte'

	let email = $state($page.url.searchParams.get('email') || '')
	let stage = $state('signin')
	$effect.pre(() => {
		if ($page.url.searchParams.has('reset')) {
			stage = 'confirm_reset'
		}
		if ($page.url.searchParams.has('create')) {
			stage = 'create_password'
		}
	})
</script>

<main in:fade class="primo-reset">
	<div class="left">
		<div class="logo">
			<div class="logo-container">
				<ServerLogo />
			</div>
		</div>
		<div class="box">
			{#if stage === 'signin'}
				{#snippet footer()}
					<button onclick={() => (stage = 'reset_password')}>Forgot your password?</button>
				{/snippet}
				<AuthForm action="sign_in" title="Sign In" bind:email {footer} />
			{:else if stage === 'reset_password'}
				<AuthForm action="reset_password" title="Reset Password" bind:email />
			{:else if stage === 'confirm_reset'}
				<AuthForm action="confirm_password_reset" title="Reset Password" />
			{:else if stage === 'create_password'}
				<AuthForm action="confirm_password_reset" title="Create Password" />
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
		max-width: 450px;
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
</style>
