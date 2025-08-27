import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const PageListField = FieldBase.extend({
	type: z.literal('page-list'),
	config: z.object({
		page_type: z.string().nonempty()
	})
})

export type PageListField = z.infer<typeof PageListField>
