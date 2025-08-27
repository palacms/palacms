import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		outDir: 'pb_hooks/common',
		lib: {
			entry: 'src/lib/common/index.ts',
			formats: ['cjs'],
			fileName: 'index'
		}
	}
})
