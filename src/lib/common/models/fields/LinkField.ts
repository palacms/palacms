import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const LinkField = FieldBase.extend({
	type: z.literal('link')
})

export type LinkField = z.infer<typeof LinkField>
