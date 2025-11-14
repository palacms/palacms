import { z } from 'zod'

export const SiteSnapshot = z.object({
	id: z.string().nonempty(),
	site: z.string().nonempty(),
	file: z.string().or(z.file())
})

export type SiteSnapshot = z.infer<typeof SiteSnapshot>
