import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	optimizeDeps: {
		exclude: ['@rollup/browser', 'prettier', 'svelte/store']
	},
	plugins: [sveltekit()]
})
