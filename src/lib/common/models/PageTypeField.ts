import { z } from 'zod'
import { Field } from './Field'

export const PageTypeField = Field.and(
	z.object({
		page_type: z.string().nonempty()
	})
)

export type PageTypeField = z.infer<typeof PageTypeField>
