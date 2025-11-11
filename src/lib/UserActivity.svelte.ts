import { Context, IsDocumentVisible, watch } from 'runed'
import type { UserActivity } from './common/models/UserActivity'
import { Collaborators, Pages, PageSections, PageTypes, PageTypeSections, Sites, SiteSymbols, UserActivities } from './pocketbase/collections'
import { activity as manager, self } from './pocketbase/managers'
import { onDestroy } from 'svelte'
import { page as pageState } from '$app/state'
import { build_cms_page_url } from './pages'
import { site_context } from './builder/stores/context'
import { get } from 'svelte/store'
import { current_user } from './pocketbase/user'
import type { ObjectOf } from './pocketbase/CollectionMapping.svelte'

export type UserActivityValues = Omit<UserActivity, 'id'>

export type UserActivityInfo = {
	site: ObjectOf<typeof Sites>
	user: ObjectOf<typeof Collaborators>
	user_avatar: URL | null
	page_type: ObjectOf<typeof PageTypes> | null
	page_type_url: URL | null
	page: ObjectOf<typeof Pages> | null
	page_url: URL | null
	page_page_type: ObjectOf<typeof PageTypes> | null
	site_symbol: ObjectOf<typeof SiteSymbols> | null
	page_type_section: ObjectOf<typeof PageTypeSections> | null
	page_section: ObjectOf<typeof PageSections> | null
}

const user_activity_context = new Context<{ value: UserActivityValues }>('user_activity')

export const setUserActivity = (overrides: Partial<UserActivityValues>) => {
	const existing_context = user_activity_context.getOr({ value: null })
	if (existing_context.value) {
		// Set activity overrides through context
		watch(
			() => overrides,
			(overrides) => {
				for (const [key, value] of Object.entries(overrides)) {
					existing_context.value[key] = value
				}
				return () => {
					for (const key of Object.keys(overrides)) {
						existing_context.value[key] = ''
					}
				}
			}
		)
		return
	}

	// Initialize context with only the required fields and actual override values
	const initialValue: UserActivityValues = {
		user: '',
		site: '',
		...overrides
	}
	// Clean up empty optional fields
	if (!initialValue.page_type) delete initialValue.page_type
	if (!initialValue.page) delete initialValue.page
	if (!initialValue.site_symbol) delete initialValue.site_symbol
	if (!initialValue.page_type_section) delete initialValue.page_type_section
	if (!initialValue.page_section) delete initialValue.page_section

	let context = $state<{ value: UserActivityValues }>({
		value: initialValue
	})
	user_activity_context.set(context)
	watch(
		() => overrides,
		() => {
			// Only include fields that have actual values
			const newValue: UserActivityValues = {
				user: '',
				site: '',
				...overrides
			}
			// Clean up empty string values for optional fields
			if (!newValue.page_type) delete newValue.page_type
			if (!newValue.page) delete newValue.page
			if (!newValue.site_symbol) delete newValue.site_symbol
			if (!newValue.page_type_section) delete newValue.page_type_section
			if (!newValue.page_section) delete newValue.page_section
			context.value = newValue
		}
	)

	let task: number | undefined
	let activity: ObjectOf<typeof UserActivities> | null = null

	const track = async () => {
		clearTimeout(task)

		// Skip tracking if required fields are missing
		if (!context.value.user || !context.value.site) {
			return
		}

		try {
			if (activity) {
				activity = UserActivities.update(activity.id, context.value)
				await manager.commit()
			} else {
				activity = UserActivities.create(context.value)
				await manager.commit()
			}
		} catch (error) {
			console.warn('Failed to track user activity:', error)
			// Reset activity on error to retry creation
			activity = null
		}

		task = setTimeout(track, 5000)
	}

	const startTracking = async () => {
		if (task) return
		task = setTimeout(track, 500)
	}

	const stopTracking = async () => {
		clearTimeout(task)
		task = undefined

		if (activity) {
			// There's only one activity per user
			UserActivities.delete(activity.id)
			activity = null
			await manager.commit()
		}
	}

	const visible = new IsDocumentVisible()
	watch(
		() => ({ visible: visible.current }),
		({ visible }) => {
			if (!visible) {
				// Tab not visible
				stopTracking()
			} else if (!activity) {
				// Start or resume tracking user activity
				startTracking()
			}
		}
	)
	watch(
		() => ({ ...context.value }),
		() => {
			if (activity) {
				// Force update
				track()
			}
		}
	)

	onDestroy(stopTracking)
}

export const getUserActivity = ({ filter }: { filter?: (activity: UserActivityInfo) => unknown } = {}) => {
	const { value: site } = site_context.get()
	let activities
	try {
		activities = UserActivities.list({ filter: { site: site.id } }) ?? []
	} catch (error) {
		console.warn('Failed to load user activities:', error)
		return []
	}
	return activities
		.filter((activity) => activity.user !== get(current_user)?.id)
		.flatMap((activity): UserActivityInfo[] => {
			const site = Sites.one(activity.site)
			const user = Collaborators.one(activity.user)
			const user_avatar = user && user.avatar ? new URL(`${self.instance.baseURL}/api/files/collaborators/${user.id}/${user.avatar}`) : null
			const page_type = activity.page_type ? PageTypes.one(activity.page_type) : null
			const page_type_url = page_type && new URL(`${pageState.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'}/page-type--${page_type.id}`, pageState.url.href)
			const page = activity.page ? Pages.one(activity.page) : null
			const page_url = page && build_cms_page_url(page, pageState.url)
			const page_page_type = page && PageTypes.one(page.page_type)
			const site_symbol = activity.site_symbol ? SiteSymbols.one(activity.site_symbol) : null
			const page_type_section = activity.page_type_section ? PageTypeSections.one(activity.page_type_section) : null
			const page_section = activity.page_section ? PageSections.one(activity.page_section) : null
			return !!site &&
				!!user &&
				user_avatar !== undefined &&
				page_type !== undefined &&
				page_type_url !== undefined &&
				page !== undefined &&
				page_url !== undefined &&
				page_page_type !== undefined &&
				site_symbol !== undefined &&
				page_type_section !== undefined &&
				page_section !== undefined
				? [
						{
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
					]
				: []
		})
		.filter((activity) => !filter || filter(activity))
		.sort((a, b) => a.user.id.localeCompare(b.user.id))
		.reduce(
			([activityMap], activity) => {
				if (activityMap[activity.user.id]) {
					activityMap[activity.user.id].push(activity)
				} else {
					activityMap[activity.user.id] = [activity]
				}
				return [activityMap] satisfies [Record<string, UserActivityInfo[]>]
			},
			[{}] as [Record<string, UserActivityInfo[]>]
		)
		.reduce((_, activityMap) => Object.values(activityMap), [] as UserActivityInfo[][])
}
