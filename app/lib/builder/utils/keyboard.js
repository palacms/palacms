import { browser } from '$app/environment'

/**
 * Register a cross-platform keyboard shortcut (Cmd on Mac, Ctrl on Windows/Linux)
 * @param {import('runed').PressedKeys} keys - PressedKeys instance
 * @param {string | string[]} key - Key or keys to combine with modifier
 * @param {Function} callback - Function to call when shortcut is pressed
 */
export function onModKey(keys, key, callback) {
	const keyArray = Array.isArray(key) ? key : [key]
	
	// Mac: Cmd + key
	keys.onKeys(['meta', ...keyArray], callback)
	
	// Windows/Linux: Ctrl + key
	keys.onKeys(['control', ...keyArray], callback)
	
	// Always prevent default for modifier+key combinations
	if (browser) {
		const keyString = keyArray[keyArray.length - 1].toLowerCase()
		
		window.addEventListener('keydown', (e) => {
			const modKey = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? e.metaKey : e.ctrlKey
			if (modKey && e.key.toLowerCase() === keyString) {
				e.preventDefault()
			}
		})
	}
}

/**
 * Check if the mod key (Cmd on Mac, Ctrl on Windows/Linux) is pressed
 * @param {import('runed').PressedKeys} keys - PressedKeys instance
 * @returns {boolean}
 */
export function isModKeyPressed(keys) {
	if (!browser) return false
	
	const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
	return isMac ? keys.has('Meta') : keys.has('Control')
}