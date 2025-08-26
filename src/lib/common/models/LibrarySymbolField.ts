import { z } from 'zod'
import { Field } from './Field'

export const LibrarySymbolField = Field.and(
	z.object({
		symbol: z.string().nonempty()
	})
)

export type LibrarySymbolField = z.infer<typeof LibrarySymbolField>
