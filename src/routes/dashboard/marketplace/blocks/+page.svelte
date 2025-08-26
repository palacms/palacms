<script>
	import * as Popover from '$lib/components/ui/popover'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { processCode } from '$lib/builder/utils.js'
	import { Separator } from '$lib/components/ui/separator'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Cuboid, CirclePlus, CircleCheck } from 'lucide-svelte'
	import SymbolButton from '$lib/components/SymbolButton.svelte'
	import { Button, buttonVariants } from '$lib/components/ui/button'
	import { toast } from 'svelte-sonner'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { Label } from '$lib/components/ui/label'
	import { page } from '$app/state'
	import { LibrarySymbolGroups, LibrarySymbols } from '$lib/pocketbase/collections'
	import { marketplace } from '$lib/pocketbase/PocketBase'

	const group_id = $derived(page.url.searchParams.get('group') ?? undefined)
	const marketplace_symbol_group = $derived(group_id ? LibrarySymbolGroups.from(marketplace).one(group_id) : undefined)
	const marketplace_symbols = $derived(marketplace_symbol_group?.symbols() ?? [])
	const library_symbol_groups = $derived(LibrarySymbolGroups.list() ?? [])

	async function compile_component_head(html) {
		const compiled = await processCode({
			component: {
				html,
				css: '',
				js: ''
			}
		})
		if (!compiled.error) {
			return compiled.head
		} else return ''
	}

	let selected_group_id = $state(LibrarySymbolGroups.list()?.[0]?.id ?? '')

	let is_popover_open = $state(false)
	let added_to_library = $state(false)
	async function add_to_library() {
		// await actions.add_marketplace_symbol_to_library({ symbol, preview, group_id })
		// TODO: Implement
		throw new Error('Not implemented')
		toast.success('Block added to Library')
		added_to_library = true
	}
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">Blocks</div>
	</div>
</header>

<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if marketplace_symbols?.length}
		<ul class="blocks">
			{#each marketplace_symbols as symbol (symbol.id)}
				<li>
					<SymbolButton {symbol}>
						<Popover.Root bind:open={is_popover_open}>
							<Popover.Trigger class={buttonVariants({ variant: 'ghost', class: 'h-4 p-0' })}>
								{#if added_to_library}
									<CircleCheck />
								{:else}
									<CirclePlus />
								{/if}
							</Popover.Trigger>
							<Popover.Content class="w-80">
								<div class="grid gap-4">
									<div class="space-y-2">
										<h4 class="font-medium leading-none">Add to Library</h4>
										<p class="text-muted-foreground text-sm">Select a group for this block</p>
									</div>
									<RadioGroup.Root bind:value={selected_group_id}>
										{#each library_symbol_groups ?? [] as group}
											<div class="flex items-center space-x-2">
												<RadioGroup.Item value={group.id} id={group.id} />
												<Label for={group.id}>{group.name}</Label>
											</div>
										{/each}
									</RadioGroup.Root>
									<div class="flex justify-end">
										<Button
											onclick={() => {
												add_to_library()
												is_popover_open = false
											}}
										>
											Add to Library
										</Button>
									</div>
								</div>
							</Popover.Content>
						</Popover.Root>
					</SymbolButton>
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState icon={Cuboid} title="No Blocks to display" description="Blocks are components you can add to any site. When you create one it'll show up here." />
	{/if}
</div>

<style lang="postcss">
	ul.blocks {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 600px) {
		ul.blocks {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (min-width: 900px) {
		ul.blocks {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}

	@media (min-width: 1200px) {
		ul.blocks {
			grid-template-columns: 1fr 1fr 1fr 1fr;
		}
	}
</style>
