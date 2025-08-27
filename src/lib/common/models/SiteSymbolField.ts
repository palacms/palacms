import { z } from 'zod'
import { Field } from './Field'

export const SiteSymbolField = Field.and(
	z.object({
		symbol: z.string().nonempty()
	})
)

export type SiteSymbolField = z.infer<typeof SiteSymbolField>
