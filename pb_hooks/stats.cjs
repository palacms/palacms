/**
 * PalaCMS Usage Statistics
 *
 * This module collects anonymous usage statistics to help improve PalaCMS.
 * Data collection is privacy-focused and can be disabled by setting PALA_DISABLE_USAGE_STATS=true
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
 * To disable: Set PALA_DISABLE_USAGE_STATS=true in your environment variables
 */

/// <reference path="../pb_data/types.d.ts" />
// @ts-check

// Static usage statistics key - all self-hosted instances send to this project
const USAGE_STATS_KEY = 'phc_uh5ILOgLhZ4Pg5KLdrzTmiuZNLwsQeihA1Af1rTqNK1'
const USAGE_STATS_HOST = 'https://us.i.posthog.com'

// Check if usage statistics are enabled
function is_usage_stats_enabled() {
	return $os.getenv('PALA_DISABLE_USAGE_STATS') !== 'true'
}

// Get or create unique instance ID
function get_instance_id() {
	const new_id = () => $security.randomString(20)
	const collection = $app.findCollectionByNameOrId('telemetry_values')

	/** @type {string} */
	let instance_id
	try {
		const record = $app.findFirstRecordByData(collection.id, 'key', 'instance_id')
		instance_id = record.getString('value')
		if (!instance_id) {
			// Empty ID, let's fill it
			instance_id = new_id()
			record.set('value', instance_id)
			$app.save(record)
		}
	} catch (e) {
		// ID not found, let's create it
		instance_id = new_id()
		const record = new Record(collection)
		record.set('key', 'instance_id')
		record.set('value', instance_id)
		$app.save(record)
	}

	return instance_id
}

// Send usage statistics
function send_usage_stats() {
	if (!is_usage_stats_enabled()) return

	try {
		const stats = get_instance_stats()

		const response = $http.send({
			url: USAGE_STATS_HOST + '/i/v0/e/',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				api_key: USAGE_STATS_KEY,
				event: 'instance_heartbeat',
				distinct_id: get_instance_id(),
				properties: {
					$process_person_profile: false,
					version: get_version(),
					...stats
				},
				timestamp: new Date().toISOString()
			})
		})

		const ok = response.statusCode >= 200 && response.statusCode <= 299
		if (!ok) {
			throw new Error(`Not OK response (got ${response.statusCode})`)
		}
	} catch (error) {
		console.warn('Failed to track usage statistics:', error)
	}
}

// Get version
function get_version() {
	return $os.getenv('PALA_VERSION') || 'unknown'
}

// Get basic instance statistics (anonymous)
function get_instance_stats() {
	return {
		sites_count: $app.countRecords('sites'),
		pages_count: $app.countRecords('pages'),
		users_count: $app.countRecords('users')
	}
}

function init_usage_stats() {
	if (!is_usage_stats_enabled()) return

	// Send initial stats
	send_usage_stats()

	// Set up daily heartbeat
	cronAdd('send_palacms_usage_stats', '@daily', send_usage_stats)
}

module.exports = { init_usage_stats, is_usage_stats_enabled }
