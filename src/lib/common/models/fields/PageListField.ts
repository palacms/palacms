import { FieldBase } from '../FieldBase'
import { z } from 'zod'
import { Condition } from '../Condition'

export const PageListField = FieldBase.extend({
	type: z.literal('page-list'),
	config: z
		.object({
			page_type: z.string().nonempty(),
			condition: Condition.nullable().optional()
		})
		.nullable()
})

export type PageListField = z.infer<typeof PageListField>
