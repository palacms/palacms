import { z } from 'zod'
import { FieldBase } from '../FieldBase'

export const GroupField = FieldBase.extend({
	type: z.literal('group')
	// TODO: Sub-fields
})

export type GroupField = z.infer<typeof GroupField>
