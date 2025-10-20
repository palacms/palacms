import { z } from 'zod'

export const UserActivity = z.object({
	id: z.string().nonempty(),
	user: z.string().nonempty(),
	site: z.string().optional(),
	page_type: z.string().optional(),
	page: z.string().optional(),
	section: z.string().optional(),
	updated: z.string().optional()
})

export type UserActivity = z.infer<typeof UserActivity>
