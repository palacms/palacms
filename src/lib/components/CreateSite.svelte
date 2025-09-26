<script lang="ts">
	import { Loader, Globe, Store, Check, Library as LibraryIcon, SquarePen, Cuboid } from 'lucide-svelte'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Input } from '$lib/components/ui/input/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import { Site } from '$lib/common/models/Site'
	import {
		Sites,
		Pages,
		SiteSymbols,
		SiteSymbolFields,
		SiteSymbolEntries,
		SiteGroups,
		SiteFields,
		SiteEntries,
		SiteUploads,
		manager,
		LibrarySymbols,
		LibrarySymbolGroups,
		MarketplaceSymbols,
		MarketplaceSymbolGroups,
		MarketplaceSiteGroups,
		MarketplaceSites,
		PageTypes,
		PageEntries,
		PageSections,
		PageSectionEntries,
		PageTypeFields,
		PageTypeEntries,
		PageTypeSymbols,
		PageTypeSections,
		PageTypeSectionEntries
	} from '$lib/pocketbase/collections'
	import { page as pageState } from '$app/state'
	import Button from './ui/button/button.svelte'
	import { useCloneSite } from '$lib/workers/CloneSite.svelte'
	import SymbolButton from '$lib/components/SymbolButton.svelte'
	import Masonry from '$lib/components/Masonry.svelte'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Skeleton } from '$lib/components/ui/skeleton/index.js'
	import { self as pb, marketplace } from '$lib/pocketbase/PocketBase'
	import { watch } from 'runed'
	import { tick } from 'svelte'

	/*
  Create Site Wizard
  - Steps: name → starter → blocks
  - Flow: clone the selected starter, then optionally copy selected blocks.
  - Data sources: local PocketBase (manager/self) and marketplace (marketplace).
  - Commit: aggregate creates and call manager.commit() once per creation.
*/

	const { oncreated }: { oncreated?: () => void } = $props()

	const all_site_groups = $derived(SiteGroups.list({ sort: 'index' }) ?? [])
	// Prefer group named "Default"; otherwise fall back to the first group.
	const site_group = $derived(all_site_groups?.find((g) => g.name === 'Default') || all_site_groups?.[0])

	// Keep undefined until loaded so we can show skeletons
	const starter_sites = $derived(Sites.list({ sort: 'index' }) ?? undefined)
	// Starter groups sidebar state
	let blocks_tab = $state('library')
	let active_starters_group_id = $state(all_site_groups?.[0]?.id ?? '')
	// When groups load/update, pick first available if none selected.
	watch(
		() => (all_site_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_starters_group_id && ids.length > 0) {
				active_starters_group_id = ids[0]
			}
		}
	)

	const active_starters_group_sites = $derived(starter_sites ? (active_starters_group_id ? starter_sites.filter((s) => s.group === active_starters_group_id) : starter_sites) : undefined)
	const library_symbol_groups = $derived(LibrarySymbolGroups.list({ sort: 'index' }) ?? [])
	const marketplace_symbol_groups = $derived(MarketplaceSymbolGroups.list({ sort: 'index' }) ?? [])

	// Marketplace (Starters) - site groups and sites
	const marketplace_site_groups = $derived(MarketplaceSiteGroups.list({ sort: 'index' }) ?? [])
	let active_marketplace_starters_group_id = $state(marketplace_site_groups?.find((g) => g.name === 'Featured')?.id ?? marketplace_site_groups?.[0]?.id ?? '')
	watch(
		() => (marketplace_site_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_marketplace_starters_group_id && ids.length > 0) {
				const groups = marketplace_site_groups ?? []
				active_marketplace_starters_group_id = groups.find((g) => g.name === 'Featured')?.id ?? ids[0]
			}
		}
	)

	const marketplace_starter_sites = $derived(
		active_marketplace_starters_group_id
			? (MarketplaceSites.list({ filter: { group: active_marketplace_starters_group_id }, sort: 'index' }) ?? undefined)
			: (MarketplaceSites.list({ sort: 'index' }) ?? undefined)
	)

	// Keep separate selection for Library vs Marketplace groups
	let active_library_blocks_group_id = $state(library_symbol_groups?.find((g) => g.name === 'Featured')?.id ?? library_symbol_groups?.[0]?.id ?? '')
	let active_marketplace_blocks_group_id = $state(marketplace_symbol_groups?.find((g) => g.name === 'Featured')?.id ?? marketplace_symbol_groups?.[0]?.id ?? '')

	// When groups load/update, pick first available if none selected.
	watch(
		() => (library_symbol_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_library_blocks_group_id && ids.length > 0) {
				const groups = library_symbol_groups ?? []
				active_library_blocks_group_id = groups.find((g) => g.name === 'Featured')?.id ?? ids[0]
			}
		}
	)
	watch(
		() => (marketplace_symbol_groups ?? []).map((g) => g.id),
		(ids) => {
			if (!active_marketplace_blocks_group_id && ids.length > 0) {
				const groups = marketplace_symbol_groups ?? []
				active_marketplace_blocks_group_id = groups.find((g) => g.name === 'Featured')?.id ?? ids[0]
			}
		}
	)

	const active_library_blocks_group = $derived(active_library_blocks_group_id ? LibrarySymbolGroups.one(active_library_blocks_group_id) : undefined)
	// Undefined while loading so Masonry can render skeletons
	const active_library_blocks_group_symbols = $derived(active_library_blocks_group?.symbols() ?? undefined)

	const active_marketplace_blocks_group = $derived(active_marketplace_blocks_group_id ? MarketplaceSymbolGroups.one(active_marketplace_blocks_group_id) : undefined)
	const active_marketplace_blocks_group_symbols = $derived(active_marketplace_blocks_group?.symbols() ?? undefined)

	let site_name = $state(``)

	// Eagerly compute and load derived data when this component mounts
	$effect(() => {
		void all_site_groups
		void starter_sites
		void active_starters_group_sites
		void library_symbol_groups
		void marketplace_symbol_groups
		void marketplace_site_groups
		void marketplace_starter_sites
		void active_library_blocks_group_symbols
		void active_marketplace_blocks_group_symbols
	})

	// Stepper action: advance through steps; create on final step.
	function next_or_create() {
		if (step === 'name') {
			if (can_go_starter) step = 'starter'
			return
		}
		if (step === 'starter') {
			if (can_go_blocks) step = 'blocks'
			return
		}
		if (step === 'blocks') {
			create_site()
		}
	}

	let starter_tab = $state('sites')
	let selected_starter_id = $state(``)
	let selected_starter_source = $state<'local' | 'marketplace'>('local')
	// Select a starter site by id and source.
	function select_starter(site_id: string, source: 'local' | 'marketplace' = 'local') {
		selected_starter_id = site_id
		selected_starter_source = source
	}

	const selected_starter_site = $derived(
		selected_starter_source === 'local' ? (starter_sites ?? []).find((site) => site.id === selected_starter_id) : (marketplace_starter_sites ?? []).find((site) => site.id === selected_starter_id)
	)

	// Stepper state
	const step_order = ['name', 'starter', 'blocks'] as const
	let step = $state<(typeof step_order)[number]>('name')
	const can_go_starter = $derived(!!site_name)
	const can_go_blocks = $derived(!!site_name && !!selected_starter_id)

	// Optional blocks selection; keep resolved symbol pointers only.
	let selected_block_ids = $state<{ id: string; source: 'library' | 'marketplace' }[]>([])
	const selected_blocks = $derived(selected_block_ids.map(({ id, source }) => (source === 'library' ? LibrarySymbols.one(id) : MarketplaceSymbols.one(id))).filter(Boolean) || [])
	let selected_blocks_container: HTMLDivElement | undefined = $state()

	async function toggle_block(id: string, source: 'library' | 'marketplace' | undefined = undefined) {
		if (selected_block_ids.find((b) => b.id === id)) {
			selected_block_ids = selected_block_ids.filter((b) => b.id !== id)
		} else if (source) {
			selected_block_ids = [...selected_block_ids, { id, source }]
			// Wait for the UI to render the new block, then scroll fully to the bottom
			await tick()
			selected_blocks_container?.scrollTo({ top: selected_blocks_container.scrollHeight, behavior: 'smooth' })
		}
	}

	// Copy selected blocks into a new site:
	// - Create site_symbol, then fields (parent-first), then entries (parent-first)
	// - Preserve ordering/index and parent relationships
	// - Do not commit here; the caller commits once at the end
	async function copy_selected_blocks_to_site(site_id: string) {
		if (!selected_block_ids.length) return
		for (const block of selected_block_ids) {
			// Copy marketplace symbols to library symbols
			try {
				const symbol = selected_blocks.find((b) => b?.id === block.id)
				if (!symbol) continue

				const server = block.source === 'library' ? pb : marketplace

				// Create library symbol from marketplace symbol
				const site_symbol = SiteSymbols.create({
					name: symbol.name,
					html: symbol.html,
					css: symbol.css,
					js: symbol.js,
					site: site_id
				})

				// Get marketplace fields using pb directly to avoid effect context issues
				const source_symbol_fields = await server.collection('library_symbol_fields').getFullList({
					filter: `symbol = "${symbol.id}"`,
					sort: 'index'
				})

				if (source_symbol_fields?.length > 0) {
					const field_map = new Map()

					// Create fields in order, handling parent relationships
					const sorted_fields = [...source_symbol_fields].sort((a, b) => {
						// Fields without parents come first
						if (!a.parent && b.parent) return -1
						if (a.parent && !b.parent) return 1
						return (a.index || 0) - (b.index || 0)
					})

					for (const field of sorted_fields) {
						const parent_library_field = field.parent ? field_map.get(field.parent) : undefined

						const library_field = SiteSymbolFields.create({
							key: field.key,
							label: field.label,
							type: field.type,
							config: field.config,
							index: field.index,
							symbol: site_symbol.id,
							parent: parent_library_field?.id || undefined
						})
						field_map.set(field.id, library_field)
					}

					// Get library entries using pb directly
					const field_ids = source_symbol_fields.map((f) => f.id)
					const source_entries =
						field_ids.length > 0
							? await server.collection('library_symbol_entries').getFullList({
									filter: field_ids.map((id) => `field = "${id}"`).join(' || '),
									sort: 'index'
								})
							: []

					if (source_entries?.length > 0) {
						const entry_map = new Map()

						// Create entries in order, handling parent relationships
						const sorted_entries = [...source_entries].sort((a, b) => {
							// Entries without parents come first
							if (!a.parent && b.parent) return -1
							if (a.parent && !b.parent) return 1
							return (a.index || 0) - (b.index || 0)
						})

						for (const entry of sorted_entries) {
							const library_field = field_map.get(entry.field)
							const parent_library_entry = entry.parent ? entry_map.get(entry.parent) : undefined

							if (library_field) {
								const site_entry = SiteSymbolEntries.create({
									field: library_field.id,
									value: entry.value,
									index: entry.index,
									locale: entry.locale,
									parent: parent_library_entry?.id || undefined
								})
								entry_map.set(entry.id, site_entry)
							}
						}
					}
				}
			} catch (error) {
				console.error('Error copying marketplace symbol:', error)
				throw error
			}
		}
	}

	const cloneSite = $derived(
		useCloneSite({
			starter_site_id: selected_starter_id,
			site_name: site_name,
			site_host: pageState.url.host,
			site_group_id: site_group?.id
		})
	)

	let completed = $derived(Boolean(site_name && selected_starter_id))
	let loading = $state(false)
	// Clone a remote (marketplace) starter into a new local site.
	async function clone_marketplace_starter(remote_site_id: string, name: string, host: string, group_id: string) {
		const remote_site = await marketplace.collection('sites').getOne(remote_site_id)

		const site = Sites.create({
			name,
			description: '',
			host,
			group: group_id,
			index: 0,
			head: remote_site.head || '',
			foot: remote_site.foot || ''
		})

		// Uploads: copy files to local
		const remote_uploads = await marketplace.collection('site_uploads').getFullList({ filter: `site = "${remote_site_id}"` })
		const site_upload_map = new Map<string, any>()
		for (const remote_upload of remote_uploads) {
			const file = await fetch(`${marketplace.baseURL}/api/files/site_uploads/${remote_upload.id}/${remote_upload.file}`)
				.then((res) => res.blob())
				.then((blob) => new File([blob], remote_upload.file.toString()))
			const upload = SiteUploads.create({ file, site: site.id })
			site_upload_map.set(remote_upload.id, upload)
		}

		const map_entry_value = (value: any, field: any): unknown => {
			if (field?.type === 'image' && value?.upload) {
				return { ...value, upload: site_upload_map.get(value.upload)?.id }
			} else {
				return value
			}
		}

		// Site fields + entries
		const remote_site_fields = await marketplace.collection('site_fields').getFullList({ filter: `site = "${remote_site_id}"` })
		const remote_site_entries = await marketplace.collection('site_entries').getFullList({ filter: `field.site = "${remote_site_id}"` })
		const site_field_map = new Map<string, any>()
		const site_entry_map = new Map<string, any>()
		const create_site_fields = (parent_remote_id?: string) => {
			for (const rf of remote_site_fields) {
				const is_child = !!rf.parent
				if (parent_remote_id ? rf.parent !== parent_remote_id : is_child) continue
				const parent = rf.parent ? site_field_map.get(rf.parent) : undefined
				const field = SiteFields.create({ ...rf, id: undefined, site: site.id, parent: parent?.id })
				site_field_map.set(rf.id, field)
				create_site_fields(rf.id)
			}
		}
		create_site_fields()

		const create_site_entries = (parent_remote_id?: string) => {
			for (const re of remote_site_entries) {
				const is_child = !!re.parent
				if (parent_remote_id ? re.parent !== parent_remote_id : is_child) continue
				const field = site_field_map.get(re.field)
				const parent = re.parent ? site_entry_map.get(re.parent) : undefined
				const entry = SiteEntries.create({
					locale: re.locale,
					value: map_entry_value(re.value, field),
					field: field.id,
					parent: parent?.id,
					index: re.index
				})
				site_entry_map.set(re.id, entry)
				create_site_entries(re.id)
			}
		}
		create_site_entries()

		// Symbols + fields + entries
		const remote_symbols = await marketplace.collection('site_symbols').getFullList({ filter: `site = "${remote_site_id}"` })
		const symbol_map = new Map<string, any>()
		const symbol_field_map = new Map<string, any>()
		for (const rs of remote_symbols) {
			const symbol = SiteSymbols.create({ ...rs, id: undefined, site: site.id, compiled_js: undefined })
			symbol_map.set(rs.id, symbol)

			const remote_symbol_fields = await marketplace.collection('site_symbol_fields').getFullList({ filter: `symbol = "${rs.id}"` })
			const create_symbol_fields = (parent_remote_id?: string) => {
				for (const rf of remote_symbol_fields) {
					const is_child = !!rf.parent
					if (parent_remote_id ? rf.parent !== parent_remote_id : is_child) continue
					const parent = rf.parent ? symbol_field_map.get(rf.parent) : undefined
					const field = SiteSymbolFields.create({ ...rf, id: undefined, symbol: symbol.id, parent: parent?.id })
					symbol_field_map.set(rf.id, field)
					create_symbol_fields(rf.id)
				}
			}
			create_symbol_fields()

			const remote_symbol_entries = await marketplace.collection('site_symbol_entries').getFullList({ filter: `field.symbol = "${rs.id}"` })
			const symbol_entry_map = new Map<string, any>()
			const create_symbol_entries = (parent_remote_id?: string) => {
				for (const re of remote_symbol_entries) {
					const is_child = !!re.parent
					if (parent_remote_id ? re.parent !== parent_remote_id : is_child) continue
					const field = symbol_field_map.get(re.field)
					const parent = re.parent ? symbol_entry_map.get(re.parent) : undefined
					const entry = SiteSymbolEntries.create({
						locale: re.locale,
						value: map_entry_value(re.value, field),
						field: field.id,
						parent: parent?.id,
						index: re.index
					})
					symbol_entry_map.set(re.id, entry)
					create_symbol_entries(re.id)
				}
			}
			create_symbol_entries()
		}

		// Page types + fields + entries + symbols/sections
		const remote_page_types = await marketplace.collection('page_types').getFullList({ filter: `site = "${remote_site_id}"` })
		const page_type_map = new Map<string, any>()
		const page_type_field_map = new Map<string, any>()
		for (const rpt of remote_page_types) {
			const page_type = PageTypes.create({ ...rpt, id: undefined, site: site.id })
			page_type_map.set(rpt.id, page_type)

			const remote_page_type_fields = await marketplace.collection('page_type_fields').getFullList({ filter: `page_type = "${rpt.id}"` })
			const create_page_type_fields = (parent_remote_id?: string) => {
				for (const rf of remote_page_type_fields) {
					const is_child = !!rf.parent
					if (parent_remote_id ? rf.parent !== parent_remote_id : is_child) continue
					const parent = rf.parent ? page_type_field_map.get(rf.parent) : undefined
					const field = PageTypeFields.create({ ...rf, id: undefined, page_type: page_type.id, parent: parent?.id })
					page_type_field_map.set(rf.id, field)
					create_page_type_fields(rf.id)
				}
			}
			create_page_type_fields()

			const remote_page_type_entries = await marketplace.collection('page_type_entries').getFullList({ filter: `field.page_type = "${rpt.id}"` })
			const page_type_entry_map = new Map<string, any>()
			const create_page_type_entries = (parent_remote_id?: string) => {
				for (const re of remote_page_type_entries) {
					const is_child = !!re.parent
					if (parent_remote_id ? re.parent !== parent_remote_id : is_child) continue
					const field = page_type_field_map.get(re.field)
					const parent = re.parent ? page_type_entry_map.get(re.parent) : undefined
					const entry = PageTypeEntries.create({
						locale: re.locale,
						value: map_entry_value(re.value, field),
						field: field.id,
						parent: parent?.id,
						index: re.index
					})
					page_type_entry_map.set(re.id, entry)
					create_page_type_entries(re.id)
				}
			}
			create_page_type_entries()

			const remote_page_type_symbols = await marketplace.collection('page_type_symbols').getFullList({ filter: `page_type = "${rpt.id}"` })
			for (const rpts of remote_page_type_symbols) {
				const symbol = symbol_map.get(rpts.symbol)
				if (!symbol) continue
				PageTypeSymbols.create({ page_type: page_type.id, symbol: symbol.id })
			}

			const remote_page_type_sections = await marketplace.collection('page_type_sections').getFullList({ filter: `page_type = "${rpt.id}"` })
			for (const rpts of remote_page_type_sections) {
				const symbol = symbol_map.get(rpts.symbol)
				if (!symbol) continue
				const section = PageTypeSections.create({ page_type: page_type.id, symbol: symbol.id, index: rpts.index, zone: rpts.zone })

				const remote_page_type_section_entries = await marketplace.collection('page_type_section_entries').getFullList({ filter: `section = "${rpts.id}"` })
				const page_type_section_entry_map = new Map<string, any>()
				const create_page_type_section_entries = (parent_remote_id?: string) => {
					for (const re of remote_page_type_section_entries) {
						const is_child = !!re.parent
						if (parent_remote_id ? re.parent !== parent_remote_id : is_child) continue
						const field = symbol_field_map.get(re.field)
						const parent = re.parent ? page_type_section_entry_map.get(re.parent) : undefined
						const entry = PageTypeSectionEntries.create({
							section: section.id,
							field: field.id,
							parent: parent?.id,
							locale: re.locale,
							value: map_entry_value(re.value, field),
							index: re.index
						})
						page_type_section_entry_map.set(re.id, entry)
						create_page_type_section_entries(re.id)
					}
				}
				create_page_type_section_entries()
			}
		}

		// Pages + entries + sections
		const remote_pages = await marketplace.collection('pages').getFullList({ filter: `site = "${remote_site_id}"` })
		const page_map = new Map<string, any>()
		const create_pages = async (parent_remote_id?: string) => {
			for (const rp of remote_pages) {
				const is_child = !!rp.parent
				if (parent_remote_id ? rp.parent !== parent_remote_id : is_child) continue
				const page_type = page_type_map.get(rp.page_type)
				if (!page_type) continue
				const parent = rp.parent ? page_map.get(rp.parent) : undefined
				const page = Pages.create({
					name: rp.name,
					slug: rp.slug,
					compiled_html: undefined,
					page_type: page_type.id,
					parent: parent?.id ?? '',
					site: site.id,
					index: rp.index
				})
				page_map.set(rp.id, page)

				const remote_page_entries = await marketplace.collection('page_entries').getFullList({ filter: `page = "${rp.id}"` })
				const page_entry_map = new Map<string, any>()
				const create_page_entries = (parent_remote_id?: string) => {
					for (const re of remote_page_entries) {
						const is_child = !!re.parent
						if (parent_remote_id ? re.parent !== parent_remote_id : is_child) continue
						const field = page_type_field_map.get(re.field)
						const parent = re.parent ? page_entry_map.get(re.parent) : undefined
						const entry = PageEntries.create({
							page: page.id,
							field: field.id,
							locale: re.locale,
							value: map_entry_value(re.value, field),
							index: re.index
						})
						page_entry_map.set(re.id, entry)
						create_page_entries(re.id)
					}
				}
				create_page_entries()

				const remote_page_sections = await marketplace.collection('page_sections').getFullList({ filter: `page = "${rp.id}"` })
				for (const rps of remote_page_sections) {
					const symbol = symbol_map.get(rps.symbol)
					if (!symbol) continue
					const section = PageSections.create({ page: page.id, symbol: symbol.id, index: rps.index })

					const remote_page_section_entries = await marketplace.collection('page_section_entries').getFullList({ filter: `section = "${rps.id}"` })
					const page_section_entry_map = new Map<string, any>()
					const create_page_section_entries = (parent_remote_id?: string) => {
						for (const re of remote_page_section_entries) {
							const is_child = !!re.parent
							if (parent_remote_id ? re.parent !== parent_remote_id : is_child) continue
							const field = symbol_field_map.get(re.field)
							const parent = re.parent ? page_section_entry_map.get(re.parent) : undefined
							const entry = PageSectionEntries.create({
								section: section.id,
								field: field.id,
								parent: parent?.id,
								locale: re.locale,
								value: map_entry_value(re.value, field),
								index: re.index
							})
							page_section_entry_map.set(re.id, entry)
							create_page_section_entries(re.id)
						}
					}
					create_page_section_entries()
				}

				await create_pages(rp.id)
			}
		}
		await create_pages()

		return site
	}
	// Clone the selected starter, copy optional blocks, and commit once.
	// Calls oncreated() when finished.
	async function create_site() {
		if (!selected_starter_id) return
		loading = true
		try {
			if (selected_starter_source === 'local') {
				await cloneSite.run()
				// Find the created site for this host
				const created_sites = Sites.list({ filter: { host: pageState.url.host } }) ?? []
				const created_site = created_sites.find((s) => s.name === site_name) ?? created_sites[0]
				if (created_site) {
					await copy_selected_blocks_to_site(created_site.id)
					await manager.commit()
				}
				oncreated?.()
			} else {
				const group_id = site_group?.id ?? SiteGroups.create({ name: 'Default', index: 0 }).id
				const site = await clone_marketplace_starter(selected_starter_id, site_name, pageState.url.host, group_id)
				await copy_selected_blocks_to_site(site.id)
				await manager.commit()
				oncreated?.()
			}
		} catch (e) {
			console.error(e)
		} finally {
			loading = false
		}
	}
</script>

<div class="max-w-[1400px] h-screen px-2 flex flex-col mx-auto">
	<!-- Header -->
	<div class="pt-6 pb-6 h-[12vh] min-h-[7rem]">
		<h1 class="text-md leading-none tracking-tight text-center">Create Site</h1>

		<!-- Stepper -->
		<div class="max-w-[900px] justify-self-center mt-4 flex items-center gap-4 overflow-x-auto whitespace-nowrap w-full">
			<!-- Step 1 -->
			<button class="flex items-center gap-3 focus:outline-none whitespace-nowrap" onclick={() => (step = 'name')}>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('name')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if can_go_starter}
						<Check class="w-4 h-4" />
					{:else}
						<SquarePen class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'name' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Enter Name</span>
			</button>

			<div class="border-t border-border h-px flex-1"></div>

			<!-- Step 2 -->
			<button
				class="flex items-center gap-3 focus:outline-none whitespace-nowrap {can_go_starter ? '' : 'opacity-50 pointer-events-none'}"
				onclick={() => (step = 'starter')}
				disabled={!can_go_starter}
			>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('starter')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if can_go_blocks}
						<Check class="w-4 h-4" />
					{:else}
						<Globe class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'starter' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Choose a Starter</span>
			</button>
			<div class="border-t border-border h-px flex-1"></div>

			<!-- Step 3 -->
			<button class="flex items-center gap-3 focus:outline-none whitespace-nowrap {can_go_blocks ? '' : 'opacity-50 pointer-events-none'}" onclick={() => (step = 'blocks')} disabled={!can_go_blocks}>
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {step_order.indexOf(step) >= step_order.indexOf('blocks')
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-foreground'}"
				>
					{#if selected_block_ids.length > 0}
						<Check class="w-4 h-4" />
					{:else}
						<Cuboid class="w-4 h-4" />
					{/if}
				</div>
				<span class="text-sm {step === 'blocks' ? 'text-foreground font-medium' : 'text-muted-foreground'}">Add Blocks (optional)</span>
			</button>
		</div>
	</div>

	<!-- Content -->
	{#if step === 'name'}
		<!-- Identity -->
		<div class="rounded-lg border bg-[#111] p-4 shadow-sm w-full max-w-lg mx-auto">
			<form
				class="grid w-full items-center gap-1.5"
				onsubmit={(e) => {
					e.preventDefault()
					can_go_starter ? (step = 'starter') : null
				}}
			>
				<Label for="site-name">Site Name</Label>
				<Input
					type="text"
					id="site-name"
					value={site_name}
					oninput={(e) => {
						site_name = (e.currentTarget as HTMLInputElement).value.trim()
					}}
					autofocus
				/>
			</form>
		</div>
	{/if}

	{#if step === 'starter'}
		<Tabs.Root bind:value={starter_tab} class="h-[78vh] min-h-[30rem] w-full grid grid-cols-5 gap-4 flex-1 rounded-lg border bg-[#111] p-3 shadow-sm">
			<!-- Left: groups + grid -->
			<div class="col-span-5 md:col-span-3 flex flex-col">
				<Tabs.List
					class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full h-11 grid-cols-2 gap-1 p-1 text-sm font-semibold leading-[0.01em] dark:border dark:border-neutral-600/30"
				>
					<Tabs.Trigger value="sites" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<Globe class="h-4 w-4" />
						<span>Sites</span>
					</Tabs.Trigger>
					<Tabs.Trigger value="marketplace" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<Store class="h-4 w-4" />
						<span>Marketplace</span>
					</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="sites" class="grid grid-cols-4 flex-1">
					{#if active_starters_group_sites === undefined}
						<!-- Loading skeletons for local starters -->
						{#each Array.from({ length: 6 }) as _}
							<Skeleton class="aspect-video w-full" />
						{/each}
					{:else if starter_sites?.length === 0}
						<EmptyState
							class="h-full col-span-4"
							icon={Globe}
							title="No sites to display"
							description="You don't have any sites here yet. When you create one, you'll be able to use it as a starting point for other sites. In the meantime, check the marketplace."
							button={{
								label: 'Open Marketplace',
								icon: Store,
								onclick: () => (starter_tab = 'marketplace')
							}}
						/>
					{:else}
						<!-- Groups sidebar -->
						<div class="h-full md:border-r col-span-1">
							<div class="p-2 text-xs text-muted-foreground">Groups</div>
							<ul class="p-2 pt-0 flex flex-col gap-1">
								{#each all_site_groups ?? [] as group (group.id)}
									<li>
										<button
											class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_starters_group_id === group.id ? 'bg-accent text-accent-foreground' : ''}"
											onclick={() => (active_starters_group_id = group.id)}
										>
											{group.name}
										</button>
									</li>
								{/each}
							</ul>
						</div>
						<!-- Server Sites grid -->
						<div class="col-span-3 p-3">
							{#if active_starters_group_sites?.length === 0}
								<div class="text-sm text-muted-foreground p-6 text-center">No sites in this group.</div>
							{:else if active_starters_group_sites}
								<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
									{#each active_starters_group_sites as site}
										{@render StarterButton(site.id, site.name, site)}
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</Tabs.Content>

				<!-- Marketplace-->
				<Tabs.Content value="marketplace" class="grid grid-cols-4 flex-1">
					<!-- Groups sidebar -->
					<div class="h-full md:border-r col-span-1">
						<div class="p-2 text-xs text-muted-foreground">Groups</div>
						<ul class="p-2 pt-0 flex flex-col gap-1">
							{#each marketplace_site_groups ?? [] as group (group.id)}
								<li>
									<button
										class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_marketplace_starters_group_id === group.id
											? 'bg-accent text-accent-foreground'
											: ''}"
										onclick={() => (active_marketplace_starters_group_id = group.id)}
									>
										{group.name}
									</button>
								</li>
							{/each}
						</ul>
					</div>
					<!-- Marketplace Sites grid -->
					<div class="p-3 pr-0 grid gap-4 col-span-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
						{#if marketplace_starter_sites === undefined}
							{#each Array.from({ length: 6 }) as _}
								<Skeleton class="aspect-video w-full" />
							{/each}
						{:else}
							{#each marketplace_starter_sites as site (site.id)}
								{@render StarterButton(site.id, site.name, site, 'marketplace')}
							{/each}
							{#if (marketplace_starter_sites?.length ?? 0) === 0}
								<div class="text-sm text-muted-foreground p-6 text-center">No starters in this group.</div>
							{/if}
						{/if}
					</div>
				</Tabs.Content>
			</div>

			<!-- Right: preview takes 2/5 -->
			<div class="col-span-5 md:col-span-2">
				<div class="rounded-md bg-muted/20 h-full">
					{#if selected_starter_site}
						<SitePreview style="height: 100%" site={selected_starter_site} src={selected_starter_source === 'marketplace' ? `https://palacms.com/?_site=${selected_starter_site.id}` : undefined} />
					{/if}
				</div>
			</div>
		</Tabs.Root>
	{/if}

	{#if step === 'blocks'}
		<Tabs.Root bind:value={blocks_tab} class="h-[75vh] min-h-[30rem] w-full grid grid-cols-5 gap-4 flex-1 rounded-lg border bg-[#111] p-3 shadow-sm overflow-hidden">
			<!-- Left: Groups + Masonry -->
			<div class="col-span-5 md:col-span-4 flex flex-col overflow-hidden">
				<Tabs.List
					class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full h-11 grid-cols-2 gap-1 p-1 text-sm font-semibold leading-[0.01em] dark:border dark:border-neutral-600/30"
				>
					<Tabs.Trigger value="library" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<LibraryIcon class="h-4 w-4" />
						<span>Library</span>
					</Tabs.Trigger>
					<Tabs.Trigger value="marketplace" class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[4px] bg-transparent py-2 data-[state=active]:bg-white flex gap-2">
						<Store class="h-4 w-4" />
						<span>Marketplace</span>
					</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="library" class="grid grid-cols-4 flex-1 overflow-hidden">
					{#if library_symbol_groups.length === 0}
						<EmptyState
							class="col-span-4"
							icon={LibraryIcon}
							title="Your Library is empty"
							description="Curate and create blocks in your Library. Add blocks from the Marketplace or create your own to reuse across sites."
							button={{
								label: 'Open Marketplace',
								icon: Store,
								onclick: () => (blocks_tab = 'marketplace')
							}}
						/>
					{:else}
						<!-- Groups sidebar -->
						<div class="h-full md:border-r col-span-1 overflow-auto">
							<div class="p-2 text-xs text-muted-foreground">Groups</div>
							<ul class="p-2 pt-0 flex flex-col gap-1">
								{#each library_symbol_groups ?? [] as group (group.id)}
									<button
										class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_library_blocks_group_id === group.id ? 'bg-accent text-accent-foreground' : ''}"
										onclick={() => (active_library_blocks_group_id = group.id)}
									>
										{group.name}
									</button>
								{/each}
							</ul>
						</div>
						<!-- Library Blocks masonry -->
						<Masonry columnCount={2} class="col-span-3 p-3 pr-0 overflow-auto" items={active_library_blocks_group_symbols} loading={active_library_blocks_group_symbols === undefined}>
							{#snippet children(symbol)}
								<div class="relative">
									<SymbolButton {symbol} onclick={() => toggle_block(symbol.id, 'library')} />
									{#if selected_block_ids.find((b) => b.id === symbol.id)}
										<div class="pointer-events-none absolute inset-0 bg-[#000000AA] flex items-center justify-center">
											<Check class="text-primary" />
										</div>
									{/if}
								</div>
							{/snippet}
						</Masonry>
					{/if}
				</Tabs.Content>

				<!-- Marketplace-->
				<Tabs.Content value="marketplace" class="grid grid-cols-4 flex-1 overflow-hidden">
					<!-- Groups sidebar -->
					<div class="h-full md:border-r col-span-1 overflow-scroll">
						<div class="p-2 text-xs text-muted-foreground">Groups</div>
						<ul class="p-2 pt-0 flex flex-col gap-1">
							{#each marketplace_symbol_groups ?? [] as group (group.id)}
								<li>
									<button
										class="w-full text-left px-2 py-1 rounded-md hover:bg-accent hover:text-accent-foreground {active_marketplace_blocks_group_id === group.id
											? 'bg-accent text-accent-foreground'
											: ''}"
										onclick={() => (active_marketplace_blocks_group_id = group.id)}
									>
										{group.name}
									</button>
								</li>
							{/each}
						</ul>
					</div>
					<!-- Marketplace Blocks masonry -->
					<Masonry columnCount={2} class="col-span-3 p-3 pr-0 overflow-scroll" items={active_marketplace_blocks_group_symbols} loading={active_marketplace_blocks_group_symbols === undefined}>
						{#snippet children(symbol)}
							<div class="relative">
								<SymbolButton {symbol} onclick={() => toggle_block(symbol.id, 'marketplace')} />
								{#if selected_block_ids.find((b) => b.id === symbol.id)}
									<div class="pointer-events-none absolute inset-0 bg-[#000000AA] flex items-center justify-center">
										<Check class="text-primary" />
									</div>
								{/if}
							</div>
						{/snippet}
					</Masonry>
				</Tabs.Content>
			</div>

			<!-- Right: Selected Blocks -->
			<div class="col-span-5 md:col-span-1 rounded-lg border h-full px-3 flex flex-col overflow-hidden">
				<div class="py-2 text-xs border-b text-muted-foreground flex items-center justify-between">
					<div>
						<span>Selected Blocks</span>
						{#if selected_blocks.length > 0}
							<span class="text-xs text-muted-foreground">({selected_blocks.length})</span>
						{/if}
					</div>
					{#if selected_block_ids.length > 0}
						<button class="text-xs underline" onclick={() => (selected_block_ids = [])}>Clear</button>
					{/if}
				</div>
				{#if selected_blocks.length > 0}
					<div class="grid gap-3 sm:grid-cols-1 overflow-scroll mt-4 pb-2" bind:this={selected_blocks_container}>
						{#each selected_blocks as block (block?.id)}
							{#if block}
								<div class="relative">
									<SymbolButton symbol={block} />
									<button class="absolute top-2 right-2 text-xs bg-background/80 border rounded px-1" onclick={() => toggle_block(block.id)}>Remove</button>
								</div>
							{/if}
						{/each}
					</div>
				{:else}
					<div class="text-sm text-muted-foreground p-6 text-center">Nothing Selected Yet — Add optional blocks in addition to those in the starter.</div>
				{/if}
			</div>
		</Tabs.Root>
	{/if}

	<!-- Footer -->
	<div class="h-[10vh] bg-background pt-4 pb-4 flex items-center z-10">
		<div class={step === 'name' ? 'w-full max-w-lg mx-auto flex justify-end gap-3' : 'w-full max-w-[1400px] mx-auto flex justify-end gap-3'}>
			<Button
				onclick={next_or_create}
				disabled={loading || (step === 'name' && !can_go_starter) || (step === 'starter' && !can_go_blocks) || (step === 'blocks' && !completed)}
				class="inline-flex justify-center items-center relative"
			>
				{#if loading}
					<Loader class="h-4 w-4 animate-spin" />
				{:else}
					{step === 'blocks' ? 'Done' : 'Next'}
				{/if}
			</Button>
		</div>
	</div>
</div>

{#snippet StarterButton(id: string, name: string, site?: Site, source: 'local' | 'marketplace' = 'local')}
	<button onclick={() => select_starter(id, source)} class="group relative w-full aspect-[.69] rounded-lg border bg-background overflow-hidden text-left">
		<div class="relative h-full">
			<!-- Ensure preview reserves the same height as the card to avoid tall grid rows -->
			<SitePreview {site} src={source === 'marketplace' ? `https://palacms.com/?_site=${id}` : undefined} />
			{#if selected_starter_id === id}
				<div class="pointer-events-none absolute inset-0 bg-[#000000AA] flex items-center justify-center">
					<Check class="text-primary" />
				</div>
			{/if}
		</div>
		<div class="absolute bottom-0 w-full p-3 z-20 bg-[#000] border-t">
			<div class="text-sm leading-none truncate">{name}</div>
		</div>
	</button>
{/snippet}
