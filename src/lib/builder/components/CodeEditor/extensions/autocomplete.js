import { svelteLanguage } from '@replit/codemirror-lang-svelte'
import { cssLanguage } from '@codemirror/lang-css'
import { snippetCompletion, autocompletion } from '@codemirror/autocomplete'
import * as _ from 'lodash-es'

const Completion_Label = (value) => {
	if (Array.isArray(value)) {
		return `[ ${typeof value[0]} ]`
	} else if (_.isObject(value)) {
		return (
			'{ ' +
			Object.entries(value)
				.map(([key, value]) => `${key}:${typeof value}`)
				.join(', ') +
			' }'
		)
	} else {
		return typeof value
	}
}

function svelteCompletions(completions) {
	// Return an autocompletion source function
	return (context) => {
		const word = context.matchBefore(/\{[a-zA-Z0-9_]*/)
		if (!word || !completions || completions.length === 0) return null

		// For any match starting with {
		return {
			from: word.from + 1, // Skip the opening brace
			options: completions,
			validFor: /^[a-zA-Z0-9_]*$/
		}
	}
}

function cssCompletions(list = []) {
	const variables = list.map((item) => item.substring(0, item.length))
	return cssLanguage.data.of({
		autocomplete: (context) => {
			const word = context.matchBefore(/\S*/)
			if (!word.text.startsWith('var(')) return null
			return {
				from: word.from,
				options: variables.map((item) => ({
					label: `var(${item})`,
					type: 'text',
					apply: `var(${item}`
				}))
			}
		}
	})
}

export function updateCompletions(Editor, variables, compartment) {
	Editor.dispatch({
		effects: compartment.reconfigure(cssCompletions(variables))
	})
}

export function extract_css_variables(css) {
	return css.match(/--\S*:/gm) || []
}

export { cssCompletions, svelteCompletions }
