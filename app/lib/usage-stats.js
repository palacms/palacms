/**
 * PalaCMS Usage Statistics
 * 
 * This module collects anonymous usage statistics to help improve PalaCMS.
 * Data collection is privacy-focused and can be disabled by setting DISABLE_USAGE_STATS=true
 * 
 * What we collect:
 * - Anonymous instance ID (random UUID, not linked to any personal data)
 * - PalaCMS version number
 * - Count of sites, pages, and users (numbers only, no content)
 * - Basic error events (sanitized, no user data)
 * - Geographic location (city-level only)
 * 
 * What we DON'T collect:
 * - Email addresses or usernames
 * - Site content, URLs, or custom code
 * - IP addresses (anonymized by PostHog)
 * - Session recordings or screenshots
 * - Any personally identifiable information
 * 
 * To disable: Set DISABLE_USAGE_STATS=true in your environment variables
 * or localStorage.setItem('disable_usage_stats', 'true')
 */

import { browser } from '$app/environment'
import posthog from 'posthog-js'
import { get } from 'idb-keyval'
import { nanoid } from 'nanoid'

// Static usage statistics key - all self-hosted instances send to this project
const USAGE_STATS_KEY = 'phc_uh5ILOgLhZ4Pg5KLdrzTmiuZNLwsQeihA1Af1rTqNK1'
const USAGE_STATS_HOST = 'https://us.i.posthog.com'

let instance_id = null
let usage_stats_enabled = true

// Check if usage statistics are disabled
function is_usage_stats_disabled() {
	// Check various environment variables
	return import.meta.env.DISABLE_USAGE_STATS === 'true' || globalThis?.localStorage?.getItem('disable_usage_stats') === 'true'
}

// Get or create unique instance ID
async function get_instance_id() {
	if (instance_id) return instance_id

	try {
		instance_id = await get('palacms_instance_id')
		if (!instance_id) {
			instance_id = nanoid()
			await import('idb-keyval').then(({ set }) => set('palacms_instance_id', instance_id))
		}
	} catch (e) {
		// Fallback to localStorage if IndexedDB fails
		instance_id = localStorage.getItem('palacms_instance_id') || nanoid()
		localStorage.setItem('palacms_instance_id', instance_id)
	}

	return instance_id
}

// Initialize PostHog for usage statistics with privacy settings
export async function init_usage_stats() {
	if (!browser || is_usage_stats_disabled()) {
		usage_stats_enabled = false
		return
	}

	try {
		posthog.init(USAGE_STATS_KEY, {
			api_host: USAGE_STATS_HOST,

			// Privacy settings - disable all tracking features except events
			disable_session_recording: true,
			disable_surveys: true,
			disable_compression: false,
			disable_persistence: false,

			// Don't capture pageviews automatically
			capture_pageview: false,
			capture_pageleave: false,

			// Reduce data collection
			property_blacklist: ['$initial_referrer', '$initial_referring_domain'],

			// Set instance ID as distinct ID
			bootstrap: {
				distinctID: await get_instance_id()
			}
		})

		console.log('PalaCMS usage statistics initialized')
	} catch (error) {
		console.warn('Failed to initialize usage statistics:', error)
		usage_stats_enabled = false
	}
}

// Send basic instance heartbeat for usage statistics
export async function track_heartbeat() {
	if (!usage_stats_enabled || !browser) return

	try {
		const stats = await get_instance_stats()

		posthog.capture('instance_heartbeat', {
			instance_id: await get_instance_id(),
			version: get_version(),
			...stats
		})
	} catch (error) {
		console.warn('Failed to track usage statistics:', error)
	}
}

// Track specific events for usage statistics
export function track_event(event_name, properties = {}) {
	if (!usage_stats_enabled || !browser) return

	try {
		posthog.capture(event_name, {
			instance_id: instance_id,
			...properties
		})
	} catch (error) {
		console.warn('Failed to track usage event:', error)
	}
}

// Get version - hardcoded for now, should be injected at build time
function get_version() {
	// TODO: Replace with build-time injection via Vite define or env variable
	return '3.0.0-beta.3'
}

// Get basic instance statistics (anonymous)
async function get_instance_stats() {
	try {
		// Import PocketBase client directly to avoid reactive context issues
		const { self: pb } = await import('$lib/pocketbase/PocketBase')

		// Use the raw PocketBase client to get counts
		const [sites, pages, users] = await Promise.all([
			pb
				.collection('sites')
				.getList(1, 1, { fields: 'id' })
				.catch(() => ({ totalItems: 0 })),
			pb
				.collection('pages')
				.getList(1, 1, { fields: 'id' })
				.catch(() => ({ totalItems: 0 })),
			pb
				.collection('users')
				.getList(1, 1, { fields: 'id' })
				.catch(() => ({ totalItems: 0 }))
		])

		return {
			sites_count: sites.totalItems || 0,
			pages_count: pages.totalItems || 0,
			users_count: users.totalItems || 0
		}
	} catch (error) {
		console.warn('Failed to get instance stats:', error)
		return {
			sites_count: 0,
			pages_count: 0,
			users_count: 0,
			timestamp: Date.now()
		}
	}
}

// Send heartbeat every 24 hours
let heartbeat_interval = null

export function start_heartbeat() {
	if (!usage_stats_enabled || heartbeat_interval) return

	// Send initial heartbeat
	track_heartbeat()

	// Set up daily heartbeat
	heartbeat_interval = setInterval(
		() => {
			track_heartbeat()
		},
		24 * 60 * 60 * 1000
	) // 24 hours
}

export function stop_heartbeat() {
	if (heartbeat_interval) {
		clearInterval(heartbeat_interval)
		heartbeat_interval = null
	}
}
