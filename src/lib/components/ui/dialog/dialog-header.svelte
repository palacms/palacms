<script lang="ts">
	import DialogTitle from './dialog-title.svelte'
	import type { HTMLAttributes } from 'svelte/elements'
	import type { WithElementRef } from 'bits-ui'
	import { Loader } from 'lucide-svelte'
	import { cn } from '$lib/utils.js'
	import { Button } from '$lib/components/ui/button'
	import { mod_key_held } from '$lib/builder/stores/app/misc.js'

	let {
		ref = $bindable(null),
		class: className,
		children,
		title,
		button,
		...restProps
	}: WithElementRef<
		HTMLAttributes<HTMLDivElement> & {
			title: string
			button?: {
				label: string
				onclick: () => void
				disabled?: boolean
				loading?: boolean
				hint?: string
			}
		}
	> = $props()
</script>

<div bind:this={ref} class={cn('grid grid-cols-3 items-center', className)} {...restProps}>
	<div class="ml-4">
		{@render children?.()}
	</div>
	<DialogTitle class="text-center">{title}</DialogTitle>
	{#if button?.label}
		<Button variant="default" onclick={button.onclick} disabled={button.disabled} class="justify-self-end inline-flex justify-center items-center relative">
			<span class:opacity-0={(button.hint && $mod_key_held) || button.loading}>
				{button.label}
			</span>
			{#if button.hint && $mod_key_held && !button.loading}
				<span class="absolute inset-0 flex items-center justify-center">
					{button.hint}
				</span>
			{/if}
			{#if button.loading}
				<div class="animate-spin absolute inset-0 flex items-center justify-center">
					<Loader />
				</div>
			{/if}
		</Button>
	{/if}
</div>
