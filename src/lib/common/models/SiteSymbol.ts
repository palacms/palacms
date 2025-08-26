import { z } from 'zod'
import { Symbol } from './Symbol'

export const SiteSymbol = Symbol.extend({
	site: z.string().nonempty(),
	compiled_js: z.string().or(z.file()).optional()
})

export type SiteSymbol = z.infer<typeof SiteSymbol>
