import { rollup } from '@rollup/browser'
import svelteWorker from './svelte.worker?worker'
import PromiseWorker from 'promise-worker'
import registerPromiseWorker from 'promise-worker/register'
import commonjs from './plugins/commonjs'
import json from './plugins/json'
import glsl from './plugins/glsl'
import { VERSION as SVELTE_VERSION } from 'svelte/compiler'

const sveltePromiseWorker = new PromiseWorker(new svelteWorker())

// Based on https://github.com/pngwn/REPLicant & the Svelte REPL package (https://github.com/sveltejs/sites/tree/master/packages/repl)

// Use esm.sh for all remote module resolution, like the original worker
const CDN_URL = 'https://esm.sh'
const SVELTE_CDN = `${CDN_URL}/svelte@${SVELTE_VERSION}`

registerPromiseWorker(rollup_worker)
async function rollup_worker({ component, head, hydrated, buildStatic = true, css = 'external', format = 'esm', dev_mode = false }) {
	const final = {
		ssr: '',
		dom: '',
		error: ''
	}

	try {
		const component_lookup = new Map()

		const App_Wrapper = (components, head) => {
			const field_keys = Object.entries(head.data).filter((field) => field[0])
			return `
			<svelte:head>
				${head.code}
			</svelte:head>
			<script>
			  let props = $props();

				${components.map((_, i) => `import Component_${i} from './Component_${i}.svelte';`).join('\n')}
				${components.map((_, i) => `let { component_${i}_props } = props;`).join(`\n`)}

				let { head_props } = props;
				${field_keys.map((field) => `let ${field[0]} = head_props['${field[0]}'];`).join(`\n`)}
			</script>
			${components.map((component, i) => (component.wrapper_start ?? '') + `<Component_${i} {...component_${i}_props} />` + (component.wrapper_end ?? '')).join('\n')}
		`
		}

		const Component = (component) => {
			let { html, css, js, data } = component

			const field_keys = Object.keys(data).filter((key) => !!key)

			// html must come first for LoC (inspector) to work
			return `\
					${html}
          <script>
            ${`let { ${field_keys.join(', ')} } = $props();` /* e.g. let { heading, body } = $props(); */}
            ${js}
          </script>
          ${css ? `<style>${css}</style>` : ``}`
		}

		function generate_lookup(component, head) {
			if (Array.isArray(component)) {
				// build page (sections as components)
				component.forEach((section, i) => {
					const code = Component(section)
					component_lookup.set(`./Component_${i}.svelte`, code)
				})
				component_lookup.set(`./App.svelte`, App_Wrapper(component, head))
			} else {
				// build individual component
				const app_code = Component(component)
				component_lookup.set(`./App.svelte`, app_code)
			}
		}

		generate_lookup(component, head)

		if (buildStatic) {
			const bundle = await compile({
				generate: 'server',
				css: 'injected',
				runes: true
			})

			const output = (await bundle.generate({ format })).output[0].code
			final.ssr = output
		} else {
			const bundle = await compile({
				generate: 'client',
				css,
				dev: dev_mode,
				runes: true
			})

			const output = (await bundle.generate({ format })).output[0].code
			final.dom = output
		}

		// If static build needs to be hydrated, include Svelte JS (or just render normal component)
		if (hydrated) {
			const bundle = await compile({
				generate: 'client',
				css: 'external',
				runes: true
			})
			const output = (await bundle.generate({ format })).output[0].code
			final.dom = output
		}

		async function compile(svelteOptions = {}) {
			return await rollup({
				input: './App.svelte',
				// Keep remote modules external; browser will fetch them by URL
				external: (id) => /^https?:/.test(id),
				plugins: [
					commonjs,
					{
						name: 'repl-plugin',
						async resolveId(importee, importer) {
							// 1) Virtual esm-env
							if (importee === 'esm-env') return 'virtual:esm-env'

							// 2) Local virtual files (in-memory Svelte sources)
							if (component_lookup.has(importee)) return importee

							// 3) Absolute remote URL stays as-is
							if (/^https?:/.test(importee)) return importee

							// 4) Resolve relative from remote importer
							if (importee.startsWith('.')) {
								if (importer && /^https?:/.test(importer)) return new URL(importee, importer).href
								return importee
							}

							// 5) Handle esm.sh absolute subpaths
							if (importer && importer.startsWith(`${CDN_URL}/`)) {
								if (importee.startsWith(`${CDN_URL}/`)) return importee
								if (importee.startsWith('/')) return new URL(importee, CDN_URL).href
							}

							// 6) Svelte runtime pinned
							if (importee === 'svelte') return SVELTE_CDN
							if (importee.startsWith('svelte/')) return `${SVELTE_CDN}/${importee.slice('svelte/'.length)}`

							// 7) Bare package → let esm.sh resolve
							return `${CDN_URL}/${importee}`
						},
						async load(id) {
							if (id === 'virtual:esm-env') {
								return `export const DEV = false; export const PROD = true; export const BROWSER = true;`
							}
							if (component_lookup.has(id)) return component_lookup.get(id)
							return null
						},
						async transform(code, id) {
							// our only transform is to compile svelte components
							//@ts-ignore
							if (!/.*\.svelte/.test(id)) return null

							try {
								const res = await sveltePromiseWorker.postMessage({
									code,
									svelteOptions
								})
								return res.code

								// TODO: reinstate warnings, pass along to UI instead of throwing
								// const warnings = res.warnings
								// 	.filter((w) => !w.message.startsWith(`Component has unused export`))
								// 	.filter((w) => !w.message.startsWith(`A11y: <img> element should have an alt attribute`))
								// 	.filter((w) => w.code !== `a11y-missing-content`)
								// 	.filter((w) => !w.message.startsWith(`Unused CSS selector`)) // TODO: reinstate
								// if (warnings[0]) {
								// 	final.error = warnings[0].message
								// 	return ''
								// } else {
								// 	return res.code
								// }
							} catch (e) {
								const error_message = e instanceof Error ? e.message : String(e)
								console.error('Svelte compilation error:', error_message)
								final.error = error_message
								return ''
							}
						}
					},
					json,
					glsl
					// replace({
					//   'process.env.NODE_ENV': JSON.stringify('production'),
					// }),
				]
				// inlineDynamicImports: true
			})
		}
	} catch (e) {
		const error_message = e instanceof Error ? e.message : String(e)
		console.error('Rollup worker error:', error_message, e)
		final.error = error_message
	}

	return final
}

/** Removed legacy remote resolution helpers; esm.sh handles bare specifiers. */
