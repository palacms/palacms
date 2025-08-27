<script lang="ts">
	import { onMount } from 'svelte'
	import * as _ from 'lodash-es'
	import { fade } from 'svelte/transition'
	import * as Dialog from '$lib/components/ui/dialog'
	import ImageField from '$lib/builder/field-types/ImageField.svelte'
	import LinkField from '$lib/builder/field-types/Link.svelte'
	import VideoModal from '$lib/builder/views/modal/VideoModal.svelte'
	import Icon from '@iconify/svelte'
	import Typography from '@tiptap/extension-typography'
	import StarterKit from '@tiptap/starter-kit'
	import Image from '@tiptap/extension-image'
	import Youtube from '@tiptap/extension-youtube'
	import Highlight from '@tiptap/extension-highlight'
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
	import Link from '@tiptap/extension-link'
	import { all, createLowlight } from 'lowlight'
	import { tick, createEventDispatcher } from 'svelte'
	import { createUniqueID } from '$lib/builder/utils'
	import { processCode, compare_urls } from '$lib/builder/utils'
	import { hovering_outside } from '$lib/builder/utilities'
	import { locale } from '$lib/builder/stores/app/misc'
	import { site_html } from '$lib/builder/stores/app/page'
	import MarkdownButton from './MarkdownButton.svelte'
	import { watch } from 'runed'
	import { component_iframe_srcdoc } from '$lib/builder/components/misc'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { SiteSymbols, type PageSections, type PageTypeSections, PageSectionEntries, PageTypeSectionEntries, manager, Sites } from '$lib/pocketbase/collections'
	import { Editor, Extension } from '@tiptap/core'
	import { renderToHTMLString, renderToMarkdown } from '@tiptap/static-renderer'
	import { useContent } from '$lib/Content.svelte'

	const lowlight = createLowlight(all)

	const dispatch = createEventDispatcher()

	// Define extensions for both the editor and static HTML generation
	const tiptapExtensions = [
		StarterKit.configure({
			codeBlock: false, // Disable default codeBlock as we're using CodeBlockLowlight
			link: false // Disable default link as we're using custom Link configuration
		}),
		Image,
		Youtube.configure({
			modestBranding: true
		}),
		Typography,
		CodeBlockLowlight.configure({
			lowlight
		}),
		Link.configure({
			HTMLAttributes: {
				'data-tiptap-link': 'true'
			},
			openOnClick: false
		}),
		Highlight.configure({ multicolor: false })
	]

	let { block, section }: { block: ObjectOf<typeof SiteSymbols>; section: ObjectOf<typeof PageTypeSections> | ObjectOf<typeof PageSections> } = $props()

	let node = $state()

	const fields = $derived(block.fields())
	const entries = $derived('page_type' in section ? section.entries() : 'page' in section ? section.entries() : undefined)
	const data = $derived(useContent(section))
	const component_data = $derived(data && (data[$locale] ?? {}))

	let floating_menu = $state()
	let bubble_menu = $state()
	let image_editor = $state()
	let image_editor_is_visible = $state(false)

	let link_editor_is_visible = $state(false)

	let active_editor = $state()
	let formatting_state = $state({
		bold: false,
		italic: false,
		highlight: false
	})

	// Store editor instances by markdown ID so we can access them later
	let markdown_editors = new Map()

	let error = $state('')

	let generated_js = $state('')
	async function generate_component_code(block) {
		const safeData = component_data && typeof component_data === 'object' ? component_data : {}
		const res = await processCode({
			component: {
				head: '',
				html: block.html,
				css: block.css,
				js: block.js,
				data: safeData
			},
			buildStatic: false
		})

		if (res.error) {
			error = res.error
			dispatch_mount()
		} else {
			error = ''
			generated_js = res.js
		}
	}

	let scrolling = false
	let is_editing = $state(false)

	const markdown_classes = {}
	let field_save_timeout

	function handle_lock() {
		is_editing = true
	}

	function handle_unlock() {
		is_editing = false
		dispatch('unlock')
	}

	function update_formatting_state() {
		if (active_editor) {
			formatting_state = {
				bold: active_editor.isActive('bold'),
				italic: active_editor.isActive('italic'),
				highlight: active_editor.isActive('highlight')
			}
		}
	}

	async function make_content_editable() {
		if (!node?.contentDocument) return

		const doc = node.contentDocument
		const valid_elements = Array.from(doc.querySelectorAll(`img, a, p, span, h1, h2, h3, h4, h5, h6, div`)).filter((element) => {
			const [child_node] = Array.from(element.childNodes).filter((node) => {
				const has_text = node?.nodeName === '#text' && node.nodeValue.trim().length > 0
				return has_text
			})

			const html = element?.innerHTML?.trim() || ''

			if (html || child_node || element.tagName === 'IMG' || element.tagName === 'A') {
				return true
			}
		})

		// loop over component_data and match to elements
		const assigned_entry_ids = new Set() // elements that have been matched to a field ID

		const static_field_types = ['text', 'link', 'image', 'markdown']
		const static_fields = fields.filter((f) => static_field_types.includes(f.type)) ?? []

		for (const field of static_fields) {
			const relevant_entries = entries.filter((e) => e.field === field.id)
			for (const entry of relevant_entries) {
				search_elements_for_value({
					id: entry.id,
					key: field.key,
					value: entry.value,
					type: field.type,
					config: field.config
				})
			}
		}

		function search_elements_for_value({ id, key, value, type, options = {} }) {
			for (const element of valid_elements) {
				if (element.dataset['entry']) continue // element is already tagged, skip

				const matched = match_value_to_element({
					id,
					key,
					value,
					type,
					element,
					options
				})
				if (matched) {
					assigned_entry_ids.add(id)
					break
				}
			}
		}

		function match_value_to_element({ id, element, key, value, type, options = {} }) {
			// if (value === '' || !value) return false

			// ignore element
			if (element.dataset.key === '') {
				return false
			}

			// Match by explicitly set key
			const key_matches = element.dataset.key === key
			if (key_matches) {
				if (type === 'markdown') {
					set_editable_markdown({ element, key, id })
				} else if (type === 'image') {
					set_editable_image({ element, id, options })
				} else if (type === 'link') {
					set_editable_link({ element, id, url: value.url })
				} else {
					set_editable_text({ element, id })
				}
				return true
			}

			// Match by inferring key by type
			if (type === 'link' && element.nodeName === 'A') {
				const external_url_matches = value.url?.replace(/\/$/, '') === element.href?.replace(/\/$/, '')
				const internal_url_matches = window.location.origin + value.url?.replace(/\/$/, '') === element.href?.replace(/\/$/, '')
				const link_matches = (external_url_matches || internal_url_matches) && value.label === element.innerText

				if (link_matches) {
					set_editable_link({ element, id, key, url: value.url })
					return true
				}
			} else if (type === 'image' && element.nodeName === 'IMG') {
				const image_matches = compare_urls(value.url, element.src)
				if (image_matches) {
					set_editable_image({ element, id, options })
					return true
				}
			} else if (type === 'markdown' && element.nodeName === 'DIV') {
				const html = element.innerHTML?.trim()
				const html_matches = html === value.html
				if (html_matches && html.length > 0) {
					set_editable_markdown({ element, key, id })
					return true
				}
			} else if (type === 'text') {
				const text = element.innerText?.trim()
				const text_matches = typeof value == 'string' && value.trim() === text

				// All other field types are text
				if (text_matches && text.length > 0) {
					set_editable_text({ id, element })
					return true
				} else return false
			}
		}

		async function set_editable_markdown({ id, key, element }) {
			const html = element.innerHTML.trim()
			element.innerHTML = ''

			// move element classes to tiptap div
			const markdown_id = element.getAttribute('data-markdown-id') || createUniqueID()
			let saved_markdown_classes = markdown_classes[markdown_id]
			if (!saved_markdown_classes) {
				markdown_classes[markdown_id] = element.className
				saved_markdown_classes = markdown_classes[markdown_id]
				element.classList.remove(...element.classList)
				element.setAttribute('data-markdown-id', markdown_id) // necessary since data-markdown-id gets cleared when hydrating (i.e. editing from fields)
			}

			const editor = new Editor({
				content: html,
				element,
				extensions: [
					...tiptapExtensions,
					Extension.create({
						onFocus() {
							active_editor = editor
							handle_lock()
							dispatch('lock')
							update_formatting_state()
						},
						onSelectionUpdate() {
							update_formatting_state()
						},
						onBlur: async ({ event }) => {
							// Don't call handle_unlock for markdown - let it stay locked
							dispatch('unlock')
							// Final save on blur
							clearTimeout(field_save_timeout)
							const json = editor.getJSON()
							const html = renderToHTMLString({
								extensions: tiptapExtensions,
								content: json
							})
							const markdown = renderToMarkdown({
								extensions: tiptapExtensions,
								content: json
							})
							save_edited_value({ id, value: { html, markdown } })
							setTimeout(() => {
								// Hide floating menu on blur, timeout so click registers first
								if (floating_menu) floating_menu.style.display = 'none'
							}, 100)
						},
						onUpdate: async ({ editor }) => {
							// Debounce saves to avoid constant re-renders while editing
							clearTimeout(field_save_timeout)
							field_save_timeout = setTimeout(async () => {
								const json = editor.getJSON()
								const html = renderToHTMLString({
									extensions: tiptapExtensions,
									content: json
								})
								const markdown = renderToMarkdown({
									extensions: tiptapExtensions,
									content: json
								})
								save_edited_value({ id, value: { html, markdown } })
							}, 200)
						}
					})
				],
				editorProps: {
					attributes: {
						class: saved_markdown_classes,
						'data-markdown-id': markdown_id
					}
				}
			})

			// Store the editor instance for later access
			markdown_editors.set(markdown_id, editor)
		}

		async function set_editable_image({ element, id, options }) {
			let rect
			element.setAttribute(`data-entry`, id)
			element.onmousemove = (e) => {
				if (!image_editor_is_visible) {
					attach_image_overlay(e)
				}
			}
			async function attach_image_overlay(e) {
				image_editor_is_visible = true
				await tick()
				const iframe_rect = node.getBoundingClientRect()
				rect = element.getBoundingClientRect()
				image_editor.style.left = `${rect.left + iframe_rect.left}px`
				image_editor.style.top = `${rect.top + iframe_rect.top}px`
				image_editor.style.width = `${rect.width}px`
				image_editor.style.height = `${rect.height}px`
				image_editor.style.borderRadius = getComputedStyle(element).borderRadius

				image_editor.onwheel = (e) => {
					image_editor_is_visible = false
				}

				image_editor.onmouseleave = (e) => {
					const is_outside = e.x >= Math.floor(rect.right) || e.y >= Math.floor(rect.bottom) || e.x <= Math.floor(rect.left) || e.y <= Math.floor(rect.top)
					if (is_outside) {
						image_editor_is_visible = false
					}
				}
				image_editor.onclick = () => {
					current_image_element = element
					current_image_id = id
					// Set current_image_value from the entry
					const entry = entries?.find((entry) => entry.id === id)
					current_image_value = entry?.value || {
						url: element.src || '',
						alt: element.alt || ''
					}
					editing_image = true
					image_editor_is_visible = false
				}
			}
		}

		async function set_editable_link({ element, id, url }) {
			element.style.outline = '0'
			element.setAttribute(`data-entry`, id)
			element.contentEditable = true
			let updated_url = url
			let rect
			element.onkeydown = (e) => {
				if (e.code === 'Enter') {
					e.preventDefault()
					e.target.blur()
					link_editor_is_visible = false
					save_edited_value({
						id,
						value: {
							url: updated_url,
							label: element.innerText
						}
					})
				}
			}
			element.addEventListener(
				'click',
				(e) => {
					e.preventDefault()
					e.stopPropagation()
					current_link_element = element
					current_link_id = id
					// Set current_link_value from the entry
					const entry = entries?.find((entry) => entry.id === id)
					current_link_value = entry?.value || {
						url: element.href || '',
						label: element.innerText || '',
						active: true
					}
					// Hide menus when opening modal
					bubble_menu.style.display = 'none'
					floating_menu.style.display = 'none'
					editing_link = true
				},
				{ capture: true }
			)
		}

		async function set_editable_text({ id, element }) {
			element.style.outline = '0'
			element.setAttribute(`data-entry`, id)
			element.onkeydown = (e) => {
				if (e.code === 'Enter') {
					e.preventDefault()
					e.target.blur()
				}
			}
			element.oninput = (e) => {
				// Debounce saves to avoid constant re-renders while editing
				clearTimeout(field_save_timeout)
				field_save_timeout = setTimeout(() => {
					save_edited_value({ id, value: e.target.innerText })
				}, 200)
			}
			element.onblur = (e) => {
				handle_unlock()
				// Final save on blur
				clearTimeout(field_save_timeout)
				save_edited_value({ id, value: e.target.innerText })
			}
			element.onfocus = () => {
				handle_lock()
				dispatch('lock')
			}
			element.contentEditable = true
		}
	}

	async function save_edited_value({ id, value }) {
		// Find the entry by ID
		const entry = entries?.find((entry) => entry.id === id)
		if (!entry) {
			console.error('Entry not found for ID:', id)
			return
		}

		// Update the entry based on section type
		if ('page_type' in section) {
			PageTypeSectionEntries.update(entry.id, { value })
		} else if ('page' in section) {
			PageSectionEntries.update(entry.id, { value })
		}

		// Commit changes with a delay to batch multiple edits
		clearTimeout(commit_task)
		commit_task = setTimeout(() => manager.commit(), 500)
	}

	let commit_task

	let mounted = false
	function dispatch_mount() {
		if (!mounted) {
			dispatch('mount')
			mounted = true
		}
	}

	// Reroute links to correctly open externally and internally, and handle TipTap images
	async function reroute_links() {
		if (!node?.contentDocument) return
		const { pathname, origin } = window.location
		const [site] = pathname.split('/').slice(1)
		const site_url = `${origin}/${site}`

		// Handle TipTap images (they don't have entries but should be editable)
		node.contentDocument.querySelectorAll('img').forEach((image) => {
			// Skip images that are already handled by field entries
			if (image.dataset.entry || image.dataset.key) {
				return
			}

			// Only handle images that are within markdown fields
			const markdownContainer = image.closest('[data-markdown-id]')
			if (!markdownContainer) {
				return
			}

			// Handle TipTap markdown images
			let rect
			image.onmousemove = (e) => {
				if (!image_editor_is_visible) {
					attach_tiptap_image_overlay(image)
				}
			}
		})

		async function attach_tiptap_image_overlay(element) {
			image_editor_is_visible = true
			await tick()
			const iframe_rect = node.getBoundingClientRect()
			const rect = element.getBoundingClientRect()
			image_editor.style.left = `${rect.left + iframe_rect.left}px`
			image_editor.style.top = `${rect.top + iframe_rect.top}px`
			image_editor.style.width = `${rect.width}px`
			image_editor.style.height = `${rect.height}px`
			image_editor.style.borderRadius = getComputedStyle(element).borderRadius

			image_editor.onwheel = (e) => {
				image_editor_is_visible = false
			}

			image_editor.onmouseleave = (e) => {
				const is_outside = e.x >= Math.floor(rect.right) || e.y >= Math.floor(rect.bottom) || e.x <= Math.floor(rect.left) || e.y <= Math.floor(rect.top)
				if (is_outside) {
					image_editor_is_visible = false
				}
			}

			image_editor.onclick = () => {
				current_image_element = element
				current_image_id = null // No entry for TipTap images
				// Set current_image_value from the element
				current_image_value = {
					url: element.src || '',
					alt: element.alt || ''
				}
				editing_image = true
				image_editor_is_visible = false
			}
		}

		node.contentDocument.querySelectorAll('a').forEach((link) => {
			// Skip editable links - they have their own handlers
			if (link.dataset.entry || link.dataset.key) {
				return
			}

			// Handle TipTap markdown links
			if (link.dataset.tiptapLink === 'true') {
				link.onclick = (e) => {
					e.preventDefault()
					current_link_id = null // No entry for TipTap links
					current_link_element = link // Store the link element for TipTap links
					current_link_value = {
						url: link.href || '',
						label: link.textContent || '',
						active: true
					}
					bubble_menu.style.display = 'none'
					floating_menu.style.display = 'none'
					editing_link = true
				}
				return
			}

			link.onclick = (e) => {
				e.preventDefault()
			}

			// link internally
			if (window.location.host === link.host) {
				// TODO: restore, but use a 'link' button
				// link navigates to site home
				// if (link.pathname === '/') {
				// 	link.addEventListener('click', () => {
				// 		goto(`${site_url}/`)
				// 	})
				// 	return
				// }
				// const page_slugs = link.pathname.split('/').slice(1)
				// const page_path = page_slugs.join('/')
				// // Link to page
				// const page_exists = page_slugs.every((slug, i) => {
				// 	const parent_page_id = $pages.find((p) => p.slug === page_slugs[i - 1])?.id || null
				// 	return $pages.find((p) => p.slug === slug && p.parent === parent_page_id)
				// })
				// if (page_exists) {
				// 	link.addEventListener('click', () => {
				// 		goto(`${site_url}/${page_path}`)
				// 	})
				// } else {
				// 	// TODO: Create page
				// }
			} else {
				openLinkInNewWindow(link)
			}

			function openLinkInNewWindow(link) {
				if (link.dataset.key || link.dataset.entry) return // is editable
				if (!link.dataset.listenerAdded) {
					link.addEventListener('click', () => {
						window.open(link.href, '_blank')
					})
					link.dataset.listenerAdded = 'true'
				}
			}
		})
	}

	function on_page_scroll() {
		image_editor_is_visible = false
		link_editor_is_visible = false
		bubble_menu.style.display = 'none'
		floating_menu.style.display = 'none'
	}

	function on_hover_outside_image_editor(e) {
		if (hovering_outside(e, image_editor)) {
			image_editor_is_visible = false
		}
	}

	let compiled_code = $state<string>('')
	// Watch for changes in block code or component data and regenerate
	watch(
		() => ({ html: block.html, css: block.css, js: block.js, data: component_data }),
		({ html, data }) => {
			if (compiled_code !== html && Object.keys(component_data).length > 0) {
				generate_component_code(block)
				compiled_code = html
			}
		}
	)

	let mutation_observer
	let iframe_resize_observer = $state()

	onMount(() => {
		mutation_observer = new MutationObserver(() => {
			dispatch_mount()
			reroute_links()
		})

		// Resize component iframe wrapper on resize to match content height (message set from `setup_component_iframe`)
		window.addEventListener('message', (event) => {
			if (node && event.data?.type === 'resize') {
				if (event.data.id === section.id) {
					node.style.height = event.data.height + 'px'
				}
			}
		})

		// Hide Editor UI on scroll and hover outside
		document.querySelector('#Page')?.addEventListener('scroll', on_page_scroll)
		document.querySelector('#Page')?.addEventListener('mouseover', on_hover_outside_image_editor)

		return () => {
			mutation_observer?.disconnect()
			iframe_resize_observer?.disconnect()

			document.querySelector('#Page')?.removeEventListener('scroll', on_page_scroll)
			document.querySelector('#Page')?.removeEventListener('mouseover', on_hover_outside_image_editor)
		}
	})

	function update_menu_positions() {
		if (!node?.contentDocument || !floating_menu || !bubble_menu) return

		// Hide menus if any modal is open
		if (editing_link || editing_image || editing_video) {
			bubble_menu.style.display = 'none'
			floating_menu.style.display = 'none'
			return
		}

		const iframe_rect = node.getBoundingClientRect()
		const selection = node.contentDocument.getSelection()

		if (selection?.rangeCount > 0) {
			const range = selection.getRangeAt(0)
			const hasSelection = selection.toString().length > 0

			// Bubble menu logic - only show in markdown fields
			if (hasSelection) {
				// Check if selection is within a markdown field
				const commonAncestor = range.commonAncestorContainer
				const element = commonAncestor.nodeType === 3 ? commonAncestor.parentElement : commonAncestor
				const markdownContainer = element?.closest('[data-markdown-id]')

				if (markdownContainer) {
					const rect = range.getBoundingClientRect()
					bubble_menu.style.position = 'fixed'
					bubble_menu.style.left = `${rect.left + iframe_rect.left}px`
					bubble_menu.style.top = `${rect.bottom + iframe_rect.top + 10}px`
					bubble_menu.style.display = 'flex'
				} else {
					bubble_menu.style.display = 'none'
				}
			} else {
				bubble_menu.style.display = 'none'
			}

			// Floating menu logic - only show in markdown fields
			const startNode = range.startContainer
			const blockElement = startNode.nodeType === 3 ? startNode.parentElement : startNode
			const isInMarkdownField = blockElement?.closest('[data-markdown-id]')
			const isTopLevelBlock = blockElement?.parentElement?.matches('.ProseMirror')
			const isEmptyParagraph = blockElement?.textContent === ''
			const isAtStart = range.startOffset === 0

			if (isEmptyParagraph && isAtStart && isTopLevelBlock && isInMarkdownField) {
				const rect = blockElement.getBoundingClientRect()
				floating_menu.style.position = 'fixed'
				floating_menu.style.left = `${rect.left + iframe_rect.left + 10}px`
				floating_menu.style.top = `${rect.top + iframe_rect.top + 7}px`
				floating_menu.style.display = 'flex'
			} else {
				floating_menu.style.display = 'none'
			}
		}
	}

	let setup_complete = $state(false)

	function setup_component_iframe() {
		setup_complete = false
		// Clear previous editor instances
		markdown_editors.clear()
		// Wait for iframe to be ready
		node.removeEventListener('load', setup)

		if (node.contentDocument.readyState === 'complete') {
			setup()
		} else {
			node.addEventListener('load', setup)
		}

		function setup() {
			const doc = node.contentDocument

			// Disconnect previous observer if it exists
			iframe_resize_observer?.disconnect()

			const update_height = () => {
				const height = doc.body.clientHeight
				window.postMessage({ type: 'resize', height, id: section.id }, '*')
				dispatch('resize')
			}

			iframe_resize_observer = new ResizeObserver(update_height)
			iframe_resize_observer.observe(doc.body)

			// Add mutation observer for DOM changes
			mutation_observer.observe(doc.body, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true
			})

			doc.addEventListener('mouseup', update_menu_positions)
			doc.addEventListener('keyup', update_menu_positions)

			setup_complete = true
		}
	}

	// Watch for changes and send to iframe when ready
	watch(
		() => ({ js: generated_js, data: component_data, ready: setup_complete && !is_editing }),
		({ js, data, ready }) => {
			if (ready && data && js) {
				send_component_to_iframe(js, data)
			}
		}
	)

	async function send_component_to_iframe(js, data) {
		try {
			node.contentWindow.postMessage({ type: 'component', payload: { js, data } }, '*')
			setTimeout(make_content_editable, 200) // wait for component to mount within iframe
		} catch (e) {
			console.error(e)
			error = e
			dispatch_mount()
		}
	}

	// Handle bubble and float menu positioning
	$effect(() => {
		const doc = node?.contentDocument
		if (doc) {
			const events = ['selectionchange', 'keyup', 'mouseup', 'touchend']

			const update = _.debounce(update_menu_positions, 50)
			events.forEach((event) => doc.addEventListener(event, update))

			return () => {
				events.forEach((event) => doc.removeEventListener(event, update))
			}
		}
	})

	let editing_image = $state(false)
	let editing_link = $state(false)
	let editing_video = $state(false)
	let current_image_element = $state(null)
	let current_image_id = $state(null)
	let current_image_value = $state({ url: '', alt: '' })
	let current_link_element = $state(null)
	let current_link_id = $state(null)
	let current_link_value = $state({ url: '', label: '', active: true })
</script>

<Dialog.Root bind:open={editing_image}>
	<Dialog.Content class="z-[999] sm:max-w-[500px] pt-12">
		{@const field = fields?.find((f) => entries?.find((e) => e.id === current_image_id)?.field === f.id) || { label: 'Image', key: 'image', type: 'image', config: {} }}
		{@const entry = {
			value: current_image_value
		}}
		<form
			onsubmit={(e) => {
				e.preventDefault()
				// Handle submit - same logic as Done button
				if (active_editor && !current_image_element) {
					// Handle TipTap editor images - only for NEW images from floating menu
					active_editor.chain().focus().setImage({ src: current_image_value.url, alt: current_image_value.alt }).run()
				} else if (current_image_element && !current_image_id) {
					// Handle existing TipTap markdown images (no entry)
					const markdownContainer = current_image_element.closest('[data-markdown-id]')
					if (markdownContainer) {
						const markdownId = markdownContainer.getAttribute('data-markdown-id')
						const editor = markdown_editors.get(markdownId)

						if (editor && editor.view) {
							// Find the image node in the document and select it, then update
							let imagePos = null
							editor.view.state.doc.descendants((node, pos) => {
								if (node.type.name === 'image' && node.attrs.src === current_image_element.src) {
									imagePos = pos
									return false // Stop searching
								}
							})

							if (imagePos !== null) {
								// Select the image node and update its attributes
								editor
									.chain()
									.focus()
									.setNodeSelection(imagePos)
									.updateAttributes('image', {
										src: current_image_value.url,
										alt: current_image_value.alt
									})
									.run()
								console.log('Updated image via TipTap commands')
							} else {
								console.log('Could not find image node, falling back to DOM update')
								current_image_element.src = current_image_value.url
								current_image_element.alt = current_image_value.alt
							}
						} else {
							// Fallback: directly update the DOM element
							console.log('falling back')
							current_image_element.src = current_image_value.url
							current_image_element.alt = current_image_value.alt
						}
					}
				} else if (current_image_element && current_image_id) {
					// Handle direct image editing (entry-based)
					current_image_element.src = current_image_value.url
					current_image_element.alt = current_image_value.alt
					save_edited_value({ id: current_image_id, value: current_image_value })
				}
				editing_image = false
			}}
		>
			<ImageField
				entity={section}
				{field}
				{entry}
				onchange={(changeData) => {
					// Extract the actual value from the nested structure
					const fieldKey = Object.keys(changeData)[0]
					const newValue = changeData[fieldKey][0].value
					current_image_value = newValue
				}}
			/>
			<div class="flex justify-end gap-2 mt-2">
				<button type="submit" class="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-md">Done</button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_link}>
	<Dialog.Content class="z-[999] sm:max-w-[500px] pt-12 overflow-visible">
		{@const field = fields?.find((f) => entries?.find((e) => e.id === current_link_id)?.field === f.id) || { label: 'Link', key: 'link', type: 'link', config: {} }}
		{@const entry = {
			value: current_link_value || { url: '', label: '', active: true }
		}}
		<form
			onsubmit={(e) => {
				e.preventDefault()
				// Handle submit - same logic as Done button
				if (active_editor && current_link_value.originalLabel !== undefined) {
					// Handle new TipTap links created from bubble menu
					const chain = active_editor.chain().focus()

					// If label changed from original selected text, replace the text
					if (current_link_value.label !== current_link_value.originalLabel) {
						// Delete selected text and insert new label with link
						chain
							.deleteSelection()
							.insertContent({
								type: 'text',
								text: current_link_value.label,
								marks: [{ type: 'link', attrs: { href: current_link_value.url } }]
							})
							.run()
					} else {
						// Just wrap existing text in link
						chain.setLink({ href: current_link_value.url }).run()
					}
				} else if (current_link_element && !current_link_id) {
					// Handle existing TipTap markdown links (clicked from content)
					current_link_element.href = current_link_value.url
					current_link_element.textContent = current_link_value.label
				} else if (current_link_element && current_link_id) {
					// Handle direct link editing (entry-based)
					current_link_element.href = current_link_value.url
					current_link_element.innerText = current_link_value.label
					save_edited_value({ id: current_link_id, value: _.cloneDeep(current_link_value) })
				}
				editing_link = false
			}}
		>
			<LinkField
				entity={section}
				{field}
				{entry}
				onchange={(changeData) => {
					// Extract the actual value from the nested structure
					const fieldKey = Object.keys(changeData)[0]
					const newValue = changeData[fieldKey][0].value
					current_link_value = newValue
				}}
			/>
			<div class="flex justify-end gap-2 mt-2">
				<button type="submit" class="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-md">Done</button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editing_video}>
	<Dialog.Content class="z-[999] sm:max-w-[500px] pt-12">
		<VideoModal
			onsave={(url) => {
				if (url) {
					active_editor.commands.setYoutubeVideo({
						src: url,
						width: '100%'
					})
				}
				editing_video = false
			}}
		/>
	</Dialog.Content>
</Dialog.Root>

{#if image_editor_is_visible}
	<button style:pointer-events={scrolling ? 'none' : 'all'} in:fade={{ duration: 100 }} class="image-editor" bind:this={image_editor}>
		<Icon icon="uil:image-upload" />
	</button>
{/if}

{#if link_editor_is_visible}
	<div in:fade={{ duration: 100 }} class="primo-reset link-editor">
		<button onclick={() => (link_editor_is_visible = false)}>
			<Icon icon="ic:round-close" />
		</button>
		<button class="icon" data-link>
			<Icon icon="heroicons-solid:external-link" />
		</button>
		<form>
			<input type="text" />
		</form>
	</div>
{/if}

{#if $site_html && generated_js}
	<iframe
		frameborder="0"
		bind:this={node}
		title="block"
		srcdoc={component_iframe_srcdoc({
			head: $site_html
		})}
		onload={setup_component_iframe}
	></iframe>
{/if}

{#if error}
	<pre>
    {@html error}
  </pre>
{/if}

<div class="menu floating-menu primo-reset" bind:this={floating_menu} style="display:{editing_link || editing_image || editing_video ? 'none' : 'none'}">
	{#if active_editor}
		<MarkdownButton
			icon="fa-solid:heading"
			onclick={() => {
				floating_menu.style.display = 'none'
				active_editor.chain().focus().toggleHeading({ level: 1 }).run()
			}}
		/>
		<MarkdownButton
			icon="fa-solid:code"
			onclick={() => {
				floating_menu.style.display = 'none'
				active_editor.chain().focus().toggleCodeBlock().run()
			}}
		/>
		<MarkdownButton
			icon="fa-solid:quote-left"
			onclick={() => {
				floating_menu.style.display = 'none'
				active_editor.chain().focus().toggleBlockquote().run()
			}}
		/>
		<MarkdownButton
			icon="fa-solid:list"
			onclick={() => {
				floating_menu.style.display = 'none'
				active_editor.chain().focus().toggleBulletList().run()
			}}
		/>
		<MarkdownButton
			icon="fa-solid:list-ol"
			onclick={() => {
				floating_menu.style.display = 'none'
				active_editor.chain().focus().toggleOrderedList().run()
			}}
		/>
		<MarkdownButton
			icon="fa-solid:image"
			onclick={() => {
				bubble_menu.style.display = 'none'
				floating_menu.style.display = 'none'
				current_image_id = null
				current_image_element = null
				current_image_value = { url: '', alt: '' }
				editing_image = true
			}}
		/>
		<MarkdownButton
			icon="lucide:youtube"
			onclick={() => {
				bubble_menu.style.display = 'none'
				floating_menu.style.display = 'none'
				editing_video = true
			}}
		/>
	{/if}
</div>
<div class="menu bubble-menu primo-reset" bind:this={bubble_menu} style="display:{editing_link || editing_image || editing_video ? 'none' : 'none'}">
	{#if active_editor}
		<MarkdownButton
			icon="fa-solid:link"
			onclick={() => {
				// Get selected text to pre-fill the link label
				const selection = active_editor.view.state.selection
				const selectedText = active_editor.view.state.doc.textBetween(selection.from, selection.to)
				current_link_id = null // No entry for new TipTap links
				current_link_element = null
				current_link_value = {
					url: '',
					label: selectedText || '',
					active: true,
					originalLabel: selectedText // Store original to check if it changed
				}
				// Hide menus when opening modal
				bubble_menu.style.display = 'none'
				floating_menu.style.display = 'none'
				editing_link = true
			}}
		/>
		<MarkdownButton
			icon="fa-solid:bold"
			onclick={() => {
				active_editor.chain().focus().toggleBold().run()
				update_formatting_state()
			}}
			active={formatting_state.bold}
		/>
		<MarkdownButton
			icon="fa-solid:italic"
			onclick={() => {
				active_editor.chain().focus().toggleItalic().run()
				update_formatting_state()
			}}
			active={formatting_state.italic}
		/>
		<MarkdownButton
			icon="fa-solid:highlighter"
			onclick={() => {
				active_editor.chain().focus().toggleHighlight().run()
				update_formatting_state()
			}}
			active={formatting_state.highlight}
		/>
	{/if}
</div>

<style lang="postcss">
	iframe {
		width: 100%;

		/* Prevent background color leaking through from behind the IFrame. */
		background-color: white;
	}
	pre {
		margin: 0;
		padding: 1rem;
		background: var(--primo-color-black);
		color: var(--color-gray-3);
		border: 1px solid var(--color-gray-6);
	}
	.menu {
		font-size: var(--font-size-1);
		display: flex;
		border-radius: var(--input-border-radius);
		/* margin-left: 0.5rem; */
		transition: opacity 0.1s;
		z-index: 999999 !important;
		box-shadow:
			0 0 #0000,
			0 0 #0000,
			0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}
	.bubble-menu {
		overflow: hidden;
		background-color: var(--color-gray-9);
		color: var(--primo-color-white);
		/* border-bottom-width: 2px; */
		border-color: var(--weave-primary-color);
	}
	.floating-menu {
		overflow: hidden;
		transform: translateY(-0.5rem);
		color: var(--color-gray-8);
		background-color: var(--primo-color-white);
	}
	.image-editor {
		position: fixed;
		font-size: 14px;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		border-bottom-right-radius: 4px;
		z-index: 9;
		transform-origin: top left;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 2rem;
		overflow: visible;

		:global(svg) {
			height: clamp(0.5rem, 50%, 4rem);
			width: auto;
		}
	}

	.link-editor {
		position: fixed;
		font-size: 14px;
		background: rgba(0, 0, 0, 0.9);
		color: white;
		z-index: 999;
		display: flex;

		button {
			background: var(--color-gray-7);
			display: flex;
			align-items: center;
			padding: 0 5px;
			border-right: 1px solid var(--color-gray-6);
		}

		input {
			padding: 2px 5px;
			background: var(--color-gray-8);
			color: var(--color-gray-1);
			outline: 0;
		}
	}
</style>
