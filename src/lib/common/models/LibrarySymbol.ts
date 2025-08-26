import { z } from 'zod'
import { Symbol } from './Symbol'

export const LibrarySymbol = Symbol.extend({
	group: z.string().nonempty()
})

export type LibrarySymbol = z.infer<typeof LibrarySymbol>
