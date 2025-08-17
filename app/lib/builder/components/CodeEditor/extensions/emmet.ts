import { abbreviationTracker, expandAbbreviation } from '@emmetio/codemirror6-plugin'

export function emmetExtension(syntax: string = 'html') {
	return abbreviationTracker({
		syntax // Specify document syntax (html, css, jsx, etc.)
	})
}

export { expandAbbreviation }
