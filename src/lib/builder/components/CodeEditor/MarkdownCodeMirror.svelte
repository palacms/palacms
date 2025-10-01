<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte'
	import { basicSetup } from 'codemirror'
	import { EditorState, Compartment } from '@codemirror/state'
	import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
	import { markdown } from '@codemirror/lang-markdown'
	import { indentWithTab } from '@codemirror/commands'
	import { vsCodeDark } from './theme'

	const dispatch = createEventDispatcher<{ change: { value: string }; save: undefined }>()

	let { value = $bindable(''), autofocus = false, placeholder = '', ...rest } = $props()

	let container: HTMLDivElement | null = null
	let view: EditorView | null = null

	const placeholderCompartment = new Compartment()

	const updateListener = EditorView.updateListener.of((update) => {
		if (update.docChanged) {
			const docValue = update.state.doc.toString()
			if (docValue !== value) {
				value = docValue
				dispatch('change', { value: docValue })
			}
		}
	})

	function createExtensions() {
		const saveShortcut = {
			key: 'Mod-s',
			run: () => {
				dispatch('save', undefined)
				return true
			}
		}

		return [
			basicSetup,
			EditorView.lineWrapping,
			markdown(),
			keymap.of([saveShortcut, indentWithTab]),
			updateListener,
			placeholderCompartment.of(placeholder ? cmPlaceholder(placeholder) : []),
			...vsCodeDark
		]
	}

	onMount(() => {
		if (!container) return

		const state = EditorState.create({
			doc: value ?? '',
			extensions: createExtensions()
		})

		view = new EditorView({
			state,
			parent: container
		})

		if (autofocus) {
			queueMicrotask(() => view?.focus())
		}

		return () => {
			view?.destroy()
			view = null
		}
	})
</script>

<div class="MarkdownCodeMirror overflow-auto" {...rest} bind:this={container}></div>

<style>
	.MarkdownCodeMirror :global(.cm-editor) {
		width: 100%;
	}

	.MarkdownCodeMirror :global(.cm-scroller) {
		overflow: auto;
	}

	.MarkdownCodeMirror :global(.cm-editor.cm-focused) {
		border-color: var(--color-gray-7);
		box-shadow: 0 0 0 1px var(--color-gray-7);
	}
</style>
