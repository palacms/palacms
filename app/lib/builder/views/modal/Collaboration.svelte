<script lang="ts">
	import type { SiteRoleAssignment } from '$lib/common/models/SiteRoleAssignment'
	import * as Dialog from '$lib/components/ui/dialog'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { manager, SiteRoleAssignments, Users, type Sites } from '$lib/pocketbase/collections'
	import Icon from '@iconify/svelte'
	import { nanoid } from 'nanoid'

	let { site }: { site: ObjectOf<typeof Sites> } = $props()

	let sending = $state(false)
	let email = $state('')
	let role = $state<SiteRoleAssignment['role']>('developer')

	async function invite_collaborator() {
		const stillLoading = !users || !server_members || !site_collborators
		if (stillLoading) {
			throw new Error('Still loading')
		}

		sending = true

		const hasSiteAccess = [...server_members, ...site_collborators.map(({ user }) => user)].some((user) => user?.email === email)
		if (hasSiteAccess) {
			throw new Error('Collaborator already exists')
		}

		const password = nanoid(30)
		const user =
			users.find((user) => user.email === email) ??
			Users.create({
				email,
				password,
				passwordConfirm: password,
				invite: 'pending'
			})
		SiteRoleAssignments.create({
			site: site.id,
			user: user.id,
			role
		})

		await manager.commit()
		email = ''
		role = 'developer'
		sending = false
	}

	let users = $derived(Users.list())
	let server_members = $derived(users?.filter(({ serverRole }) => !!serverRole))
	let site_collborators = $derived(
		site.role_assignments()?.map((assignment) => ({
			assignment,
			user: users?.find((user) => user.id === assignment.user)
		}))
	)

	const role_names = {
		developer: 'Developer',
		editor: 'Content Editor'
	}
</script>

<Dialog.Header class="mb-2" title="Site Collaborators" />

<div class="Invitation">
	<main>
		<h2>Invite site collaborator</h2>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				invite_collaborator()
			}}
		>
			<label class="subheading" for="email">Enter collaborator email</label>
			<div>
				<div class="input-group">
					<input bind:value={email} type="email" placeholder="Email address" name="email" />
					<select bind:value={role}>
						<option value="developer">Developer</option>
						<option value="editor">Content Editor</option>
					</select>
				</div>
				<button type="submit">
					{#if sending}
						<Icon icon="eos-icons:three-dots-loading" />
					{:else}
						Send invite
					{/if}
				</button>
			</div>
		</form>
		<section>
			<h3 class="subheading">People with Access</h3>
			{#if !server_members || !site_collborators}
				<span>Loading...</span>
			{:else}
				<ul>
					{#each server_members ?? [] as { email, serverRole }}
						<li>
							<span class="letter">{email[0]}</span>
							<span class="email">{email}</span>
							<span class="role">
								{role_names[serverRole ?? 'none']}
							</span>
						</li>
					{/each}
					{#each site_collborators ?? [] as { user, assignment }}
						<li>
							<span class="letter">{user?.email[0]}</span>
							<span class="email">{user?.email}</span>
							{#if user?.invite === 'pending'}
								<span class="status-pill pending">Invitation pending</span>
							{:else if user?.invite === 'sent'}
								<span class="status-pill sent">Invitation sent</span>
							{/if}
							<span class="role">
								{role_names[assignment.role]}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

<style lang="postcss">
	.Invitation {
		padding: 1rem 1.5rem;
		color: var(--color-gray-1);
		background: #111;
		overflow: auto;
		width: 100%;
	}
	main {
		display: grid;
		gap: 1.5rem;
	}
	h2 {
		font-weight: 700;
		font-size: 1rem;
	}
	.subheading {
		font-weight: 700;
		font-size: 0.75rem;
		margin-bottom: 0.5rem;
	}
	form {
		display: grid;
		/* gap: 0.25rem; */

		div {
			display: flex;
			gap: 0.5rem;
			font-size: 0.75rem;

			.input-group {
				flex: 1;
				border-radius: 4px;
				border: 1px solid var(--color-gray-7);
				color: var(--color-gray-2);
			}

			input {
				flex: 1;
				padding: 0.25rem 0.5rem;
				border-right: 1px solid var(--color-gray-8);
				background: transparent;
			}

			select {
				background: transparent;
				margin-right: 0.5rem;
				outline: 0 !important;
			}

			button {
				padding: 10px 12px;
				background: var(--color-gray-7);
				border-radius: 4px;
			}
		}
	}
	ul {
		margin-top: 0.5rem;
		display: grid;
		gap: 0.75rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 400;
		font-size: 0.75rem;
		/* color: #3a3d45; */
		.letter {
			height: 26px;
			width: 26px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: #81a6fd;
			color: white;
			font-weight: 700;
			font-size: 0.875rem;
			line-height: 0;
			border-radius: 50%;
		}
		.email {
			flex: 1;
		}
		.status-pill {
			padding: 2px 8px;
			border-radius: 12px;
			font-size: 0.625rem;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.025em;

			&.pending {
				background: rgba(251, 191, 36, 0.2);
				color: #fbbf24;
			}

			&.sent {
				background: rgba(129, 140, 248, 0.2);
				color: #818cf8;
			}
		}
	}
</style>
