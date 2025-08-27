import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const UrlField = FieldBase.extend({
	type: z.literal('url')
})

export type UrlField = z.infer<typeof UrlField>
