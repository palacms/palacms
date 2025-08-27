import { z } from 'zod'

export const SiteGroup = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	index: z.number().int().nonnegative()
})

export type SiteGroup = z.infer<typeof SiteGroup>
