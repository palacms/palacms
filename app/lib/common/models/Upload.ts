import { z } from 'zod'

export const Upload = z.object({
	id: z.string().nonempty(),
	file: z.string().nonempty().or(z.instanceof(File))
})

export type Upload = z.infer<typeof Upload>
