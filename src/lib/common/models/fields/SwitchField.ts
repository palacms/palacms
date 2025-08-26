import { FieldBase } from '../FieldBase'
import { z } from 'zod'

export const SwitchField = FieldBase.extend({
	type: z.literal('switch')
})

export type SwitchField = z.infer<typeof SwitchField>
