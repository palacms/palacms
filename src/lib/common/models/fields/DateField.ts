import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const DateField = FieldBase.extend({
	type: z.literal('date')
})

export type DateField = z.infer<typeof DateField>
