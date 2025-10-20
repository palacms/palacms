import { get, fromStore } from 'svelte/store'
import { IsDocumentVisible } from 'runed'
import type { UserActivity } from './common/models/UserActivity'
import { UserActivities } from './pocketbase/collections'
import { current_user } from '$lib/pocketbase/user'

export const useUserActivity = (data: Omit<UserActivity, 'id' | 'user'>) => {
	const visible = new IsDocumentVisible()

	const user = $derived(fromStore(current_user).current)

	// let user: User | undefined
	// const unsubscribe = current_user.subscribe((value) => {
	// 	if (!value) return
	// 	user = value
	// })

	if (!user) {
		throw new Error('No current user')
	}

	const activities = $derived(UserActivities.list({ filter: { user: user.id } }))
	const updateUserActivity = () => {
		if (!activities) {
			throw new Error('Activities not loaded')
		}

		const activity = activities.find((activity) => {
			for (const [key, value] of Object.entries(data)) {
				if (activity[key] !== value) {
					return false
				}
			}
			return true
		})
		if (activity) {
			UserActivities.update(activity.id, { ...data, user: user.id })
		} else {
			UserActivities.create({ ...data, user: user.id })
		}
	}

	$effect(() => {
		updateUserActivity()
		const interval = setInterval(updateUserActivity, 1000)
		return () => {
			clearInterval(interval)
			// unsubscribe()
		}
	})
}
