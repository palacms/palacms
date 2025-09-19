import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		outDir: 'server/common',
		lib: {
			entry: 'src/lib/common/index.ts',
			formats: ['cjs'],
			fileName: 'index'
		},
		rollupOptions: {
			output: {
				hashCharacters: 'base36'
			}
		}
	}
})
