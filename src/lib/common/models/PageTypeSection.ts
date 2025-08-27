import { z } from 'zod'

export const PageTypeSection = z.object({
	id: z.string().nonempty(),
	page_type: z.string().nonempty(),
	symbol: z.string().nonempty(),
	index: z.number().int().nonnegative(),
	zone: z.enum(['header', 'body', 'footer'])
})

export type PageTypeSection = z.infer<typeof PageTypeSection>
