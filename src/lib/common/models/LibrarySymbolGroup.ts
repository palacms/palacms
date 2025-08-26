import { z } from 'zod'

export const LibrarySymbolGroup = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	index: z.number().int().nonnegative()
})

export type LibrarySymbolGroup = z.infer<typeof LibrarySymbolGroup>
