import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const SelectField = FieldBase.extend({
	type: z.literal('select'),
	config: z
		.object({
			options: z
				.object({
					value: z.string(),
					label: z.string(),
					icon: z.string()
				})
				.array()
		})
		.nullable()
})

export type SelectField = z.infer<typeof SelectField>
