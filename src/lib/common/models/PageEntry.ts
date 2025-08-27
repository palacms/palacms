import { z } from 'zod'
import { Entry } from './Entry'

export const PageEntry = Entry.extend({
	page: z.string().nonempty()
})

export type PageEntry = z.infer<typeof PageEntry>
