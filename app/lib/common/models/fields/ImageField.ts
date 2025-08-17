import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const ImageField = FieldBase.extend({
	type: z.literal('image'),
	config: z
		.object({
			maxSizeMB: z.number().positive().optional(),
			maxWidthOrHeight: z.number().int().positive().optional()
		})
		.nullable()
})

export type ImageField = z.infer<typeof ImageField>
