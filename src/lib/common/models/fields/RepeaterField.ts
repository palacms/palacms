import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const RepeaterField = FieldBase.extend({
	type: z.literal('repeater')
})

export type RepeaterField = z.infer<typeof RepeaterField>
