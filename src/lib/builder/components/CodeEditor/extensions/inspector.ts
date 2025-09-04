import { EditorView, Decoration } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state'

const addUnderline = StateEffect.define<{ from: number; to: number }>()

const underlineField = StateField.define<DecorationSet>({
	create() {
		return Decoration.none
	},
	update(underlines, tr) {
		underlines = underlines.map(tr.changes)
		for (let e of tr.effects)
			if (e.is(addUnderline)) {
				underlines = underlines.update({
					add: [underlineMark.range(e.value.from, e.value.from)],
					filter: (f, t, value) => {
						if (value.spec.class === 'cm-highlight') return false
						else return true
					}
				})
			}
		return underlines
	},
	provide: (f) => EditorView.decorations.from(f)
})

const underlineMark = Decoration.line({ class: 'cm-highlight' })

const underlineTheme = EditorView.baseTheme({
	'.cm-highlight': {
		background: 'rgba(96,165,250,0.25)',
		outline: '1px solid rgba(96,165,250,0.6)'
	}
})

export default function highlight_active_line(Editor, loc) {
	if (!loc || !Editor) return
	let line
	try {
		line = Editor.state.doc.line(loc.line)
	} catch (_) {
		return
	}
	if (!line || line.from === line.to) return
	let effects: any[] = [addUnderline.of({ from: line.from, to: line.to }), EditorView.scrollIntoView(line.from, { y: 'center' })]
	if (!Editor.state.field(underlineField, false)) effects.push(StateEffect.appendConfig.of([underlineField, underlineTheme]))
	Editor.dispatch({ effects })
}

export function highlight_css(Editor, target: { id?: string; classes?: string[]; tag?: string } | null) {
	if (!target || !Editor) return

	const doc = Editor.state.doc
	let foundLine: number | null = null

	function testLine(lineNo: number, pattern: RegExp) {
		const line = doc.line(lineNo)
		return pattern.test(line.text)
	}

	// Build candidate patterns in priority: id, classes, tag
	const patterns: RegExp[] = []
	if (target.id) {
		const safe = target.id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
		patterns.push(new RegExp(`(^|[^a-zA-Z0-9_-])#${safe}(?:\b|[\s\.:#\[>+~,{])`))
	}
	for (const cls of target.classes || []) {
		const safe = cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
		patterns.push(new RegExp(`(^|[^a-zA-Z0-9_-])\.${safe}(?:\b|[\s\.:#\[>+~,{])`))
	}
	if (target.tag) {
		const safe = target.tag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
		patterns.push(new RegExp(`(^|[^a-zA-Z0-9_-])${safe}(?:\b|[\s\.:#\[>+~,{])`))
	}

	// Scan visible ranges first for perf, then fallback to whole doc
	const searchRanges = Editor.visibleRanges.length ? Editor.visibleRanges : [{ from: 1, to: doc.length }]

	for (const pat of patterns) {
		let matched = false
		for (const { from, to } of searchRanges) {
			for (let pos = from; pos <= to; ) {
				const line = Editor.state.doc.lineAt(pos)
				if (line.text && pat.test(line.text)) {
					foundLine = line.number
					matched = true
					break
				}
				pos = line.to + 1
			}
			if (matched) break
		}
		if (matched) break
	}

	if (foundLine) {
		// Reuse the same underline stylings as HTML inspector, and scroll into view
		let line
		try { line = Editor.state.doc.line(foundLine) } catch (_) {}
		if (line && line.from !== line.to) {
			let effects: any[] = [addUnderline.of({ from: line.from, to: line.to }), EditorView.scrollIntoView(line.from, { y: 'center' })]
			if (!Editor.state.field(underlineField, false)) effects.push(StateEffect.appendConfig.of([underlineField, underlineTheme]))
			Editor.dispatch({ effects })
		}
	}
}
