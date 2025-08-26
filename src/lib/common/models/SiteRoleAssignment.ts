import { z } from 'zod'

export const SiteRoleAssignment = z.object({
	id: z.string(),
	site: z.string().nonempty(),
	user: z.string().nonempty(),
	role: z.enum(['editor', 'developer'])
})

export type SiteRoleAssignment = z.infer<typeof SiteRoleAssignment>
