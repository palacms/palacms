<script lang="ts">
	import * as _ from 'lodash-es'
	import { Building2, LayoutTemplate, Check } from 'lucide-svelte'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Input } from '$lib/components/ui/input/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import { Site } from '$lib/common/models/Site'
	import { Sites, PageTypes, Pages, SiteSymbols, PageSections, PageSectionEntries, PageTypeSymbols, SiteSymbolFields, SiteSymbolEntries, SiteGroups, manager } from '$lib/pocketbase/collections'
	import { page as pageState } from '$app/state'
	import type { PageType } from '$lib/common/models/PageType'
	import type { Page } from '$lib/common/models/Page'
	import Button from './ui/button/button.svelte'
	import { useCloneSite } from '$lib/CloneSite.svelte'
	import { convert_markdown_to_html } from '$lib/builder/utils'
	import { current_user } from '$lib/pocketbase/user'

	const { oncreated }: { oncreated?: () => void } = $props()

	const all_site_groups = $derived(SiteGroups.list() ?? [])
	const site_group = $derived(all_site_groups?.find((g) => g.name === 'Default') || all_site_groups?.[0])

	const starter_sites = $derived(Sites.list() ?? [])

	let site_name = $state(``)

	let selected_starter_id = $state(``)
	function select_starter(site_id) {
		selected_starter_id = site_id
	}

	const selected_starter_site = $derived(starter_sites.find((site) => site.id === selected_starter_id))

	const blank_site = {
		head: '',
		foot: ''
	} satisfies Partial<Site>

	const blank_site_home_page_type = {
		name: 'Home',
		head: '',
		foot: '',
		color: '',
		icon: 'iconoir:page'
	} satisfies Partial<PageType>

	const black_site_home_page = {
		name: 'Home',
		slug: '',
		parent: ''
	} satisfies Partial<Page>

	const { cloneSite } = $derived(
		useCloneSite({
			starter_site_id: selected_starter_id,
			site_name,
			site_host: pageState.url.host,
			site_group_id: site_group?.id
		})
	)

	let completed = $derived(!!site_name && selected_starter_id)
	let loading = $state(false)
	async function create_site() {
		if (!selected_starter_id) return
		loading = true

		// Create default site group if no groups exist
		let target_site_group = site_group
		if (!target_site_group) {
			target_site_group = SiteGroups.create({
				name: 'Default',
				index: 0
			})
		}
		if (selected_starter_id === 'blank') {
			const site = Sites.create({
				...blank_site,
				name: site_name,
				description: '',
				host: pageState.url.host,
				group: target_site_group.id,
				index: 0
			})
			const page_type = PageTypes.create({
				...blank_site_home_page_type,
				name: 'Default',
				site: site.id
			})
			const page = Pages.create({
				...black_site_home_page,
				page_type: page_type.id,
				site: site.id
			})

			// Create a default "Welcome" symbol for the homepage
			const welcome_symbol = SiteSymbols.create({
				name: 'Welcome',
				html: '<div class="welcome">\n\t<h1>{heading}</h1>\n\t<h2>{subheading}</h2>\n\t<div class="body" data-key="body">{@html body.html}</div>\n</div>',
				css: '.welcome {\n  font-family: sans-serif;\n  padding: 3rem;\n\n  h1 {\n    margin-bottom: 1rem;\n  }\n  \n  h2 {\n    margin-bottom: 2rem;\n    font-weight: 500;\n  }\n  \n  .body {\n    color: #444;\n  }\n}',
				js: '',
				site: site.id
			})

			// Create fields for the Welcome symbol
			const heading_field = SiteSymbolFields.create({
				type: 'text',
				key: 'heading',
				label: 'Heading',
				symbol: welcome_symbol.id,
				index: 0,
				config: null
			})

			const subheading_field = SiteSymbolFields.create({
				type: 'text',
				key: 'subheading',
				label: 'Subheading',
				symbol: welcome_symbol.id,
				index: 1,
				config: null
			})

			const body_field = SiteSymbolFields.create({
				type: 'markdown',
				key: 'body',
				label: 'Body',
				symbol: welcome_symbol.id,
				index: 2,
				config: null
			})

			// Create field entries with default content
			SiteSymbolEntries.create({
				field: heading_field.id,
				locale: 'en',
				value: 'Welcome to Pala, the modern monolithic CMS',
				index: 0
			})

			SiteSymbolEntries.create({
				field: subheading_field.id,
				locale: 'en',
				value: "Pala gives developers the flexibility they need and content editors the simplicity they've always wanted",
				index: 0
			})

			const body_markdown =
				"Editing content in Pala is as simple as clicking on a section and typing. You can also edit a section's content by hovering over it and clicking the edit button that appears in the top left corner. \n\nTo edit component code and integrate new fields, click the code button to open the integrated code editor. You can get more advanced by setting up new Page Types for anything you can think of: blog posts, profiles, events, and more. \n\nWhen you're ready to go live, just click the Publish button and Pala will deploy your site as static files and serve it from the root domain. Plus, you can host unlimited sites from the same server!\n\nWe hope you love it — because we're just getting started.\n\nCheers,<br>Matthew & Jesse"
			const body_html = await convert_markdown_to_html(body_markdown)

			SiteSymbolEntries.create({
				field: body_field.id,
				locale: 'en',
				value: { markdown: body_markdown, html: body_html },
				index: 0
			})

			// Toggle the symbol for the page type (instead of adding it as a section)
			PageTypeSymbols.create({
				page_type: page_type.id,
				symbol: welcome_symbol.id
			})

			// Add the symbol directly to the Home page
			const page_section = PageSections.create({
				symbol: welcome_symbol.id,
				index: 0,
				page: page.id
			})

			// Add the same field entries to the page section
			PageSectionEntries.create({
				section: page_section.id,
				field: heading_field.id,
				locale: 'en',
				value: 'Welcome to Pala, the modern monolithic CMS',
				index: 0
			})

			PageSectionEntries.create({
				section: page_section.id,
				field: subheading_field.id,
				locale: 'en',
				value: "Pala gives developers the flexibility they need and content editors the simplicity they've always wanted",
				index: 0
			})

			PageSectionEntries.create({
				section: page_section.id,
				field: body_field.id,
				locale: 'en',
				value: { markdown: body_markdown, html: body_html },
				index: 0
			})

			await manager.commit()
			oncreated?.()
		} else {
			await cloneSite()
			oncreated?.()
		}
	}
</script>

<div class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4 mx-auto">
	<div class="grid grid-cols-3 items-center mb-2">
		<div class="ml-4"></div>
		<h1 class="font-semibold leading-none tracking-tight text-center">Create Site</h1>
		<Button onclick={create_site} disabled={loading || !completed} class="justify-self-end inline-flex justify-center items-center">Done</Button>
	</div>

	<Tabs.Root value="identity" class="w-full flex-1 flex flex-col gap-2 overflow-hidden">
		<Tabs.List class="w-full flex">
			<Tabs.Trigger value="identity" class="flex-1 flex items-center gap-2">
				<Building2 class="h-5 w-5" />
				Identity
			</Tabs.Trigger>
			<Tabs.Trigger value="starter" class="flex-1 flex items-center gap-2">
				<LayoutTemplate class="h-5 w-5" />
				Starter Site
			</Tabs.Trigger>
		</Tabs.List>

		<div class="flex-1 max-h-[82vh]">
			<Tabs.Content value="identity" class="p-1">
				<div class="grid w-full items-center gap-1.5">
					<Label for="site-name">Site Name</Label>
					<Input type="text" id="site-name" bind:value={site_name} />
				</div>
			</Tabs.Content>

			<Tabs.Content value="starter" class="h-full">
				<div class="flex flex-col h-full space-y-2">
					<div class="flex justify-between items-center">
						<h3>Choose a Starter Site</h3>
						<!-- <Button variant="outline" size="sm">
						<label class="flex items-center gap-2 cursor-pointer">
							<input onchange={duplicate_site_file} type="file" class="sr-only" />
							<Upload class="h-4 w-4" />
							Duplicate from site file
						</label>
					</Button> -->
					</div>
					<div class="split-container flex-1">
						<div class="h-[77vh] overflow-auto">
							<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{@render StarterButton('blank', 'Blank')}
								{#each starter_sites as site}
									{@render StarterButton(site.id, site.name, site)}
								{/each}
							</div>
						</div>
						<div style="background: #222;" class="rounded">
							{#if selected_starter_site}
								<SitePreview style="height: 100%" site={selected_starter_site} />
							{/if}
						</div>
					</div>
				</div>
			</Tabs.Content>
		</div>
	</Tabs.Root>
</div>

{#snippet StarterButton(id: string, name: string, site?: Site)}
	<button onclick={() => select_starter(id)} class="space-y-3 relative w-full bg-gray-900 rounded overflow-hidden">
		<div class="relative">
			<SitePreview {site} />
			{#if selected_starter_id === id}
				<div class="bg-black/70 absolute inset-0 w-full h-full flex items-center justify-center">
					<Check />
				</div>
			{/if}
		</div>
		<div class="absolute bottom-0 w-full p-3 z-20 bg-gray-900 truncate flex items-center justify-between">
			<div class="text-sm font-medium leading-none">{name}</div>
		</div>
	</button>
{/snippet}

<style lang="postcss">
	.split-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		overflow: hidden;
	}
</style>
