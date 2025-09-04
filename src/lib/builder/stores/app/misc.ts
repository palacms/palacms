import { writable } from 'svelte/store'

export const saved = writable(true)

export const mod_key_held = writable(false)

export const loadingSite = writable(false)

export const onMobile = !import.meta.env.SSR ? writable(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) : writable(false)

export const locale = writable('en')

export const highlightedElement = writable(null)
// Line number the mock inspector overlay should follow (editor-driven)
export const inspectorOverlayLine = writable<number | null>(null)
// Toggle for mock inspector overlay in preview
export const inspectorEnabled = writable(true)
// TODO: Potential future: track CSS target to highlight matching selector.
// For now, we only highlight the HTML line in the editor and show a visual overlay in the preview.

export const locked_blocks = writable<string[]>([])
export const active_users = writable([])

export const page_loaded = writable(false)

export const dragging_symbol = writable(false)

// Last selected Library group (session-only; no persistence)
export const last_library_group_id = writable<string | null>(null)

// Persist Field|Entry tab selection per-entity (session-only)
export const field_tabs_by_entity = writable<Record<string, Record<string, 'field' | 'entry'>>>({}) // TODO: persist
