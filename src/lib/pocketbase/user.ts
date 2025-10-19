import { self } from './managers'
import type { Site } from '$lib/common/models/Site'
import { SiteRoleAssignments, Users } from './collections'
import { writable, readonly } from 'svelte/store'

let current_user_store = writable<
	| {
			id: string
			email: string
			serverRole: '' | 'editor' | 'developer' | undefined
			siteRole: 'editor' | 'developer' | null
	  }
	| null
	| undefined
>()

export const current_user = readonly(current_user_store)

export const set_current_user = (site?: Site) => {
	const user = self.instance.authStore.record && Users.one(self.instance.authStore.record.id)
	const assignments = site && user && SiteRoleAssignments.list({ filter: { site: site.id, user: user.id } })
	const siteRole = user?.serverRole || assignments?.[0].role || null
	current_user_store.set(user && { id: user.id, email: user.email, serverRole: user.serverRole, siteRole })
}

export const check_session = async () => {
	if (self.instance.authStore.isValid) {
		return self.instance
			.collection('users')
			.authRefresh()
			.then(() => true)
			.catch(() => {
				self.instance.authStore.clear()
				return false
			})
	} else {
		return false
	}
}
