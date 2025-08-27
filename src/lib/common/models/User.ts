import { z } from 'zod'

export const User = z.object({
	id: z.string(),
	email: z.string().nonempty(),
	password: z.string().optional(),
	passwordConfirm: z.string().optional(),
	serverRole: z.enum(['editor', 'developer', '']).optional(),
	invite: z.enum(['pending', 'sent', '']).optional()
})

export type User = z.infer<typeof User>
