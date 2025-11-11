import { z } from 'zod'

export const UserActivity = z.object({
	id: z.string().min(1).catch(''),
	user: z.string().min(1).catch(''),
	site: z.string().min(1).catch(''),
	page_type: z.string().optional(),
	page: z.string().optional(),
	site_symbol: z.string().optional(),
	page_type_section: z.string().optional(),
	page_section: z.string().optional()
})

export type UserActivity = z.infer<typeof UserActivity>
