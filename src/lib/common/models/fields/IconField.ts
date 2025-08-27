import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const IconField = FieldBase.extend({
	type: z.literal('icon')
})

export type IconField = z.infer<typeof IconField>
