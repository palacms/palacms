import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { svelte } from 'codemirror-lang-svelte'

export function getLanguage(mode) {
	return {
		html: svelte(),
		css: css(),
		javascript: javascript()
	}[mode]
}
