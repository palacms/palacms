import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const SiteFieldField = FieldBase.extend({
	type: z.literal('site-field')
})

export type SiteFieldField = z.infer<typeof SiteFieldField>
