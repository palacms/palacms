import { z } from 'zod'

export const Site = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	description: z.string(),
	host: z.string().nonempty(),
	group: z.string().nonempty(),
	head: z.string(),
	foot: z.string(),
	// cloudflare project/account info for per-site deployments
	cfAccountId: z.string().optional(),
	cfProjectName: z.string().optional(),
	cfApiToken: z.string().optional(),
	preview: z.string().or(z.file()).optional(),
	index: z.number().int().nonnegative()
})

export type Site = z.infer<typeof Site>
