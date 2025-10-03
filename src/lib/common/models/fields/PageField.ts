import { z } from 'zod'
import { FieldBase } from '../FieldBase'
import { Condition } from '../Condition'

export const PageField = FieldBase.extend({
	type: z.literal('page'),
	config: z
		.object({
			page_type: z.string().nonempty(),
			condition: Condition.nullable().optional()
		})
		.nullable()
})

export type PageField = z.infer<typeof PageField>
