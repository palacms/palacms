import { z } from 'zod'

export const UserActivity = z.object({
	id: z.string().nonempty(),
	user: z.string().nonempty(),
	site: z.string().nonempty(),
	page_type: z.string().optional(),
	page: z.string().optional(),
	site_symbol: z.string().optional()
})

export type UserActivity = z.infer<typeof UserActivity>
