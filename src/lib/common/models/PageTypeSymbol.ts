import { z } from 'zod'

export const PageTypeSymbol = z.object({
	id: z.string().nonempty(),
	page_type: z.string().nonempty(),
	symbol: z.string().nonempty()
})

export type PageTypeSymbol = z.infer<typeof PageTypeSymbol>
