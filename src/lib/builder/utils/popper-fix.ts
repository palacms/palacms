export const offsetByFixedParents = {
	name: 'offsetByFixedParents',
	enabled: true,
	phase: 'read',
	fn: ({ state }) => {
		if (state.options.strategy !== 'fixed') {
			return
		}

		let el = state.elements.reference
		while (el.parentElement) {
			if (getComputedStyle(el.parentElement).position === 'fixed') {
				const rect = el.parentElement.getBoundingClientRect()
				state.modifiersData.popperOffsets.x -= rect.x
				state.modifiersData.popperOffsets.y -= rect.y
			}

			el = el.parentElement
		}
	}
} as const
