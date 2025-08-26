import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const TextField = FieldBase.extend({
	type: z.literal('text')
})

export type TextField = z.infer<typeof TextField>
