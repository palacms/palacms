import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const SelectField = FieldBase.extend({
	type: z.enum(['select']),
	options: z.array(
		z.object({
			value: z.string().nonempty(),
			label: z.string().nonempty(),
			icon: z.string()
		})
	)
})

export type SelectField = z.infer<typeof SelectField>
