import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const RichTextField = FieldBase.extend({
	type: z.literal('rich-text')
})

export type RichTextField = z.infer<typeof RichTextField>
