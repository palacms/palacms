import { z } from 'zod'

export const PageType = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	head: z.string(),
	foot: z.string(),
	color: z.string(),
	icon: z.string(),
	site: z.string().nonempty()
})

export type PageType = z.infer<typeof PageType>
