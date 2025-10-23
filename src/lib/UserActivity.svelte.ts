import { Context, IsDocumentVisible, watch } from 'runed'
import type { UserActivity } from './common/models/UserActivity'
import { UserActivities } from './pocketbase/collections'
import { self } from './pocketbase/managers'
import { onDestroy } from 'svelte'

export type UserActivityValues = Omit<UserActivity, 'id'>

const user_activity_context = new Context<{ value: UserActivityValues }>('user_activity')

export const setUserActivity = (overrides: Partial<UserActivityValues>) => {
	const existing_activity = user_activity_context.getOr({ value: null })
	if (existing_activity.value) {
		// Set activity overrides through context
		watch(
			() => overrides,
			() => {
				Object.assign(existing_activity.value, overrides)
				return () => {
					for (const key of Object.keys(overrides)) {
						existing_activity.value[key] = ''
					}
				}
			}
		)
		return
	}

	let activity = $state<{ value: UserActivityValues }>({
		value: {
			user: '',
			site: '',
			page_type: '',
			page: '',
			site_symbol: ''
		}
	})
	user_activity_context.set(activity)
	watch(
		() => overrides,
		() => {
			activity.value = {
				user: '',
				site: '',
				page_type: '',
				page: '',
				site_symbol: '',
				...overrides
			}
		}
	)

	const activities = $derived(UserActivities.list({ filter: { user: activity.value.user } }))
	let task: number | undefined
	let tracking = false
	const track = async () => {
		if (!activities) {
			throw new Error('Activities not loaded')
		}

		tracking = true

		// There's only one activity per user
		if (activities[0]) {
			UserActivities.update(activities[0].id, activity.value)
		} else {
			UserActivities.create(activity.value)
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
