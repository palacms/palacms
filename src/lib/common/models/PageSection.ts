import { z } from 'zod'

export const PageSection = z.object({
	id: z.string().nonempty(),
	page: z.string().nonempty(),
	symbol: z.string().nonempty(),
	index: z.number().int().nonnegative()
})

export type PageSection = z.infer<typeof PageSection>
