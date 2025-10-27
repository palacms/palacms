import { Context, IsDocumentVisible, watch } from 'runed'
import type { UserActivity } from './common/models/UserActivity'
import { Collaborators, Pages, PageSections, PageTypes, PageTypeSections, Sites, SiteSymbols, UserActivities } from './pocketbase/collections'
import { self } from './pocketbase/managers'
import { onDestroy } from 'svelte'
import { page as pageState } from '$app/state'
import { build_cms_page_url } from './pages'
import { site_context } from './builder/stores/context'
import { get } from 'svelte/store'
import { current_user } from './pocketbase/user'

export type UserActivityValues = Omit<UserActivity, 'id'>

const user_activity_context = new Context<{ value: UserActivityValues }>('user_activity')

export const setUserActivity = (overrides: Partial<UserActivityValues>) => {
	const existing_activity = user_activity_context.getOr({ value: null })
	if (existing_activity.value) {
		// Set activity overrides through context
		watch(
			() => overrides,
			() => {
				for (const [key, value] of Object.entries(overrides)) {
					existing_activity.value[key] = value
				}
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
				page_type_section: '',
				page_section: '',
				...overrides
			}
		}
	)

	const activities = $derived(UserActivities.list({ filter: { user: activity.value.user } }))
	let task: number | undefined
	let tracking = false
	const track = async () => {
		clearTimeout(task)
		if (!activities) {
			throw new Error('Activities not loaded')
		}

		tracking = true

		// There's only one activity per user
		if (activities[0]) {
			self.instance.collection('user_activities').update(activities[0].id, activity.value)
		} else {
			self.instance.collection('user_activities').create(activity.value)
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
			self.instance.collection('user_activities').delete(activity.id)
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
	watch(
		() => ({ ...activity.value }),
		() => {
			if (activities && tracking) {
				// Force update
				track()
			}
		}
	)

	onDestroy(stopTracking)
}

export const getUserActivity = () => {
	const { value: site } = site_context.get()
	return UserActivities.list({ filter: { site: site.id } })
		?.filter((activity) => activity.user !== get(current_user)?.id)
		.map((activity) => {
			const site = Sites.one(activity.site)
			const user = Collaborators.one(activity.user)
			const user_avatar = user && user.avatar ? `${self.instance.baseURL}/api/files/collaborators/${user.id}/${user.avatar}` : null
			const page_type = activity.page_type ? PageTypes.one(activity.page_type) : null
			const page_type_url = page_type && new URL(`${pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'}/page-type--${page_type.id}`, pageState.url.href)
			const page = activity.page ? Pages.one(activity.page) : null
			const page_url = page && build_cms_page_url(page, pageState.url)
			const page_page_type = page && PageTypes.one(page.page_type)
			const site_symbol = activity.site_symbol ? SiteSymbols.one(activity.site_symbol) : null
			const page_type_section = activity.page_type_section ? PageTypeSections.one(activity.page_type_section) : null
			const page_section = activity.page_section ? PageSections.one(activity.page_section) : null
			return (
				!!site &&
				!!user &&
				user_avatar !== undefined &&
				page_type !== undefined &&
				page_type_url !== undefined &&
				page !== undefined &&
				page_url !== undefined &&
				page_page_type !== undefined &&
				site_symbol !== undefined &&
				page_type_section !== undefined &&
				page_section !== undefined && {
					site,
					user,
					user_avatar,
					page_type,
					page_type_url,
					page,
					page_url,
					page_page_type,
					site_symbol,
					page_type_section,
					page_section
				}
			)
		})
		.filter((activity) => !!activity)
		.sort((a, b) => a.user.id.localeCompare(b.user.id))
}
