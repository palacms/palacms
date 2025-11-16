import { instance } from './instance'

const POSTHOG_KEY = 'phc_uh5ILOgLhZ4Pg5KLdrzTmiuZNLwsQeihA1Af1rTqNK1'
const POSTHOG_HOST = 'https://us.i.posthog.com'

let posthog: any = null

export const initialized = (async () => {
	if (!instance.telemetry_enabled) {
		return
	}

	// Dynamically import posthog only when telemetry is enabled
	const [
		{ default: posthogModule },
		_,
		__,
		___
	] = await Promise.all([
		import('https://cdn.jsdelivr.net/npm/posthog-js@1.280.1/dist/module.no-external/+esm'),
		import('https://cdn.jsdelivr.net/npm/posthog-js@1.280.1/dist/exception-autocapture/+esm'),
		import('https://cdn.jsdelivr.net/npm/posthog-js@1.280.1/dist/tracing-headers/+esm'),
		import('https://cdn.jsdelivr.net/npm/posthog-js@1.280.1/dist/web-vitals/+esm')
	])

	console.log({ posthogModule })

	posthog = posthogModule

	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,

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
			distinctID: instance.id,
			isIdentifiedID: true
		}
	})
})()

export default new Proxy({} as any, {
	get(_, prop) {
		if (!posthog) {
			console.warn('PostHog not initialized - telemetry disabled or still loading')
			return () => { }
		}
		return posthog[prop]
	}
})
