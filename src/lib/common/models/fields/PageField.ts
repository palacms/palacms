import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const PageField = FieldBase.extend({
	type: z.literal('page'),
	config: z.object({
		page_type: z.string().nonempty()
	})
})

export type PageField = z.infer<typeof PageField>
