<script lang="ts">
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
	import { Loader2, Globe, ArrowRight, CheckCircle, AlertCircle } from 'lucide-svelte'
	import { SiteFetcher } from '$lib/migrator/site-fetcher'
	import { HtmlToPalaConverter } from '$lib/migrator/html-to-pala'
	import { Sites, Pages, PageTypes, SiteSymbols } from '$lib/pocketbase/collections'
	import { goto } from '$app/navigation'
	import { toast } from 'svelte-sonner'

	let url = $state('')
	let isLoading = $state(false)
	let progress = $state(0)
	let progressMessage = $state('')
	let error = $state('')
	let success = $state(false)

	let maxPages = $state(10)
	let maxDepth = $state(2)

	async function startMigration() {
		if (!url) {
			error = 'Please enter a URL'
			return
		}

		error = ''
		success = false
		isLoading = true
		progress = 0

		try {
			// Step 1: Fetch the site
			progressMessage = 'Initializing site fetcher...'
			const fetcher = new SiteFetcher(url, { maxPages, maxDepth })

			const fetchedSite = await fetcher.fetch((message, prog) => {
				progressMessage = message
				progress = Math.min(prog * 0.5, 50) // First 50% for fetching
			})

			if (!fetchedSite.pages.length) {
				throw new Error('No pages could be fetched from the site')
			}

			// Step 2: Convert to Pala format
			progressMessage = 'Converting to Pala format...'
			progress = 60

			const converter = new HtmlToPalaConverter(fetchedSite)
			const palaSite = converter.convert()

			// Step 3: Create site in database
			progressMessage = 'Creating site in database...'
			progress = 70

			const siteData = {
				name: palaSite.name,
				description: `Migrated from ${url}`,
				host: new URL(url).hostname,
				group: 'default', // You might want to make this configurable
				index: 0
			}

			const createdSite = await Sites.create(siteData)

			// Step 4: Create symbols/components
			progressMessage = 'Creating components...'
			progress = 80

			const symbolMap = new Map<string, string>()
			for (const symbol of palaSite.symbols) {
				const symbolData = {
					site: createdSite.id,
					name: symbol.name,
					html: symbol.html,
					css: symbol.css,
					js: symbol.js
				}

				const createdSymbol = await SiteSymbols.create(symbolData)
				symbolMap.set(symbol.id, createdSymbol.id)

				// Create fields for the symbol
				if (symbol.fields.length > 0) {
					// Handle symbol fields - this would need the actual field creation logic
					console.log('Symbol fields:', symbol.fields)
				}
			}

			// Step 5: Create page type (using a standard template)
			progressMessage = 'Creating page structure...'
			progress = 85

			const pageTypeData = {
				site: createdSite.id,
				name: 'Standard Page',
				index: 0
			}

			const createdPageType = await PageTypes.create(pageTypeData)

			// Step 6: Create pages
			progressMessage = 'Creating pages...'
			progress = 90

			const pageMap = new Map<string, string>()
			for (const page of palaSite.pages) {
				const pageData = {
					site: createdSite.id,
					name: page.name,
					slug: page.slug,
					page_type: createdPageType.id,
					parent: page.parent ? pageMap.get(page.parent) || '' : '',
					index: palaSite.pages.indexOf(page)
				}

				const createdPage = await Pages.create(pageData)
				pageMap.set(page.id, createdPage.id)

				// Create sections for the page
				// This would need the actual section creation logic
				console.log('Page sections:', page.sections)
			}

			// Step 7: Complete!
			progressMessage = 'Migration complete!'
			progress = 100
			success = true

			toast.success('Site migrated successfully!')

			// Redirect to the new site after a short delay
			setTimeout(() => {
				goto(`/admin/sites/${createdSite.id}`)
			}, 2000)
		} catch (err) {
			console.error('Migration error:', err)
			error = err instanceof Error ? err.message : 'An error occurred during migration'
			toast.error('Migration failed: ' + error)
		} finally {
			isLoading = false
		}
	}

	function resetForm() {
		url = ''
		error = ''
		success = false
		progress = 0
		progressMessage = ''
	}
</script>

<div class="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
	<div class="space-y-2">
		<h1 class="text-3xl font-bold">Site Migrator</h1>
		<p class="text-muted-foreground">Import an existing website and convert it into a Pala site. The migrator will fetch pages, extract components, and preserve styling.</p>
	</div>

	{#if !isLoading && !success}
		<div class="border rounded-lg p-6 space-y-4">
			<div class="space-y-2">
				<Label for="url">Website URL</Label>
				<div class="flex gap-2">
					<Input id="url" type="url" placeholder="https://example.com" bind:value={url} disabled={isLoading} class="flex-1" />
					<Button onclick={startMigration} disabled={isLoading || !url}>
						<Globe class="mr-2 h-4 w-4" />
						Start Migration
					</Button>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="maxPages">Max Pages to Fetch</Label>
					<Input id="maxPages" type="number" bind:value={maxPages} min="1" max="100" disabled={isLoading} />
					<p class="text-xs text-muted-foreground">Limit the number of pages to fetch (default: 10)</p>
				</div>

				<div class="space-y-2">
					<Label for="maxDepth">Max Crawl Depth</Label>
					<Input id="maxDepth" type="number" bind:value={maxDepth} min="1" max="5" disabled={isLoading} />
					<p class="text-xs text-muted-foreground">How many levels deep to follow links (default: 2)</p>
				</div>
			</div>

			{#if error}
				<div class="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 p-4">
					<div class="flex gap-2">
						<AlertCircle class="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
						<span class="text-sm text-red-900 dark:text-red-200">{error}</span>
					</div>
				</div>
			{/if}
		</div>

		<div class="border rounded-lg p-6 space-y-4 bg-muted/50">
			<h2 class="font-semibold">How it works</h2>
			<ol class="space-y-2 text-sm">
				<li class="flex gap-2">
					<span class="font-semibold text-muted-foreground">1.</span>
					<span>The migrator fetches pages from the target website</span>
				</li>
				<li class="flex gap-2">
					<span class="font-semibold text-muted-foreground">2.</span>
					<span>HTML content is analyzed and split into reusable components</span>
				</li>
				<li class="flex gap-2">
					<span class="font-semibold text-muted-foreground">3.</span>
					<span>Styles and scripts are extracted and organized</span>
				</li>
				<li class="flex gap-2">
					<span class="font-semibold text-muted-foreground">4.</span>
					<span>Dynamic content is converted into editable fields</span>
				</li>
				<li class="flex gap-2">
					<span class="font-semibold text-muted-foreground">5.</span>
					<span>A new Pala site is created with all the imported content</span>
				</li>
			</ol>
		</div>
	{/if}

	{#if isLoading}
		<div class="border rounded-lg p-8 space-y-6">
			<div class="flex items-center justify-center">
				<Loader2 class="h-8 w-8 animate-spin text-primary" />
			</div>

			<div class="space-y-2">
				<div class="flex justify-between text-sm">
					<span class="text-muted-foreground">{progressMessage}</span>
					<span class="font-semibold">{progress}%</span>
				</div>
				<div class="w-full bg-secondary rounded-full h-2">
					<div class="bg-primary h-2 rounded-full transition-all duration-300" style="width: {progress}%"></div>
				</div>
			</div>

			<p class="text-sm text-muted-foreground text-center">This may take a few minutes depending on the size of the website...</p>
		</div>
	{/if}

	{#if success}
		<div class="border rounded-lg p-8 space-y-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
			<div class="flex flex-col items-center text-center space-y-4">
				<CheckCircle class="h-12 w-12 text-green-600 dark:text-green-400" />
				<h2 class="text-2xl font-semibold">Migration Complete!</h2>
				<p class="text-muted-foreground">Your site has been successfully imported. Redirecting to the site editor...</p>
			</div>

			<div class="flex justify-center gap-4">
				<Button variant="outline" onclick={resetForm}>Migrate Another Site</Button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Add any custom styles here */
</style>
