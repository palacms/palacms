import { z } from 'zod'

export const Condition = z.object({
  field: z.string().nullable(),
  comparison: z.enum(['=', '!=']),
  value: z.any()
})

export type Condition = z.infer<typeof Condition>

