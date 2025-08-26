import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const MarkdownField = FieldBase.extend({
	type: z.literal('markdown')
})

export type MarkdownField = z.infer<typeof MarkdownField>
