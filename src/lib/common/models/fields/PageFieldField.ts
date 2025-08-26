import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const PageFieldField = FieldBase.extend({
	type: z.literal('page-field')
})

export type PageFieldField = z.infer<typeof PageFieldField>
