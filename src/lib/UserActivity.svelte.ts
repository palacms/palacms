import { get, fromStore } from 'svelte/store'
import { IsDocumentVisible, watch } from 'runed'
import type { UserActivity } from './common/models/UserActivity'
import { UserActivities } from './pocketbase/collections'
import { current_user } from '$lib/pocketbase/user'
import { self } from './pocketbase/managers'
import { onDestroy } from 'svelte'
import { site_context } from './builder/stores/context'

export const setUserActivity = (values: Omit<UserActivity, 'id' | 'user' | 'site'>) => {
	const { value: site } = site_context.get()
	const user = $derived(fromStore(current_user).current)
	if (!user) {
		throw new Error('No current user')
	}

	const activities = $derived(UserActivities.list({ filter: { user: user.id } }))
	let task: number | undefined
	let tracking = false
	const track = async () => {
		if (!activities) {
			throw new Error('Activities not loaded')
		}

		tracking = true
		const data = {
			site: site.id,
			user: user.id,
			page: '',
			page_type: '',
			site_symbol: '',
			...values
		}

		// There's only one activity per user
		const [activity] = activities
		if (activity) {
			UserActivities.update(activity.id, data)
		} else {
			UserActivities.create(data)
		}

		await self.commit()
		task = setTimeout(track, 5000)
	}

	const stopTracking = async () => {
		tracking = false
		clearTimeout(task)

		if (activities?.length) {
			// There's only one activity per user
			const [activity] = activities
			UserActivities.delete(activity.id)
			await self.commit()
		}
	}

	const visible = new IsDocumentVisible()
	watch(
		() => ({ visible: visible.current, activities }),
		({ visible, activities }) => {
			if (!activities) {
				// Activities not loaded yet
			} else if (!visible) {
				// Tab not visible
				stopTracking()
			} else if (!tracking) {
				// Start or resume tracking user activity
				track()
			}
		}
	)

	onDestroy(stopTracking)
}
