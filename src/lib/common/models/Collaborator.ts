import { z } from 'zod'

export const Collaborator = z.object({
	id: z.string(),
	email: z.string().nonempty(),
	serverRole: z.enum(['editor', 'developer', '']).optional(),
	name: z.string().optional(),
	avatar: z.string().optional()
})

export type Collaborator = z.infer<typeof Collaborator>
