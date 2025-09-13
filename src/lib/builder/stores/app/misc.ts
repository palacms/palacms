import { writable } from 'svelte/store'

export const saved = writable(true)

export const mod_key_held = writable(false)

export const loadingSite = writable(false)

export const onMobile = !import.meta.env.SSR ? writable(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) : writable(false)

export const locale = writable('en')

export const highlightedElement = writable(null)

export const locked_blocks = writable<string[]>([])
export const active_users = writable([])

export const page_loaded = writable(false)

export const dragging_symbol = writable(false)

// Last selected Library group (session-only; no persistence)
export const last_library_group_id = writable<string | null>(null)

// Persist Field|Entry tab selection per-entity (cross-session, cross-tab)
const FIELD_TABS_KEY = 'field-tabs-by-entity:v1'
function load_field_tabs() {
  if (import.meta.env.SSR) return {}
  try {
    const raw = localStorage.getItem(FIELD_TABS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const field_tabs_by_entity = writable<Record<string, Record<string, 'field' | 'entry'>>>(load_field_tabs())

if (!import.meta.env.SSR) {
  // Write-through on change
  field_tabs_by_entity.subscribe((val) => {
    try {
      localStorage.setItem(FIELD_TABS_KEY, JSON.stringify(val))
    } catch {
      // ignore quota or serialization errors
    }
  })

  // Cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === FIELD_TABS_KEY) {
      try {
        field_tabs_by_entity.set(e.newValue ? JSON.parse(e.newValue) : {})
      } catch {
        // ignore parse errors
      }
    }
  })
}
