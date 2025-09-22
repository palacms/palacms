import { FieldBase } from '../FieldBase'
import { z } from 'zod'
import { Condition } from '../Condition'

export const ImageField = FieldBase.extend({
	type: z.literal('image'),
	config: z
		.object({
			maxSizeMB: z.number().positive().optional(),
			maxWidthOrHeight: z.number().int().positive().optional(),
			condition: Condition.nullable().optional()
		})
		.nullable()
})

export type ImageField = z.infer<typeof ImageField>
