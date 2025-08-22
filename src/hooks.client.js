import posthog from 'posthog-js'

/** @type {import('@sveltejs/kit').HandleClientError} */
export const handleError = ({ error, status }) => {
	// Only track errors if usage statistics are enabled and it's not a 404
	if (status !== 404 && posthog.__loaded) {
		// Sanitize error data to avoid exposing sensitive information
		posthog.capture('client_error', {
			error_message: error?.message || 'Unknown error',
			error_status: status,
			error_stack_first_line: error?.stack?.split('\n')[0] || null,
			timestamp: Date.now()
		})
	}
}