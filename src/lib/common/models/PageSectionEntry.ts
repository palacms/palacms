import { z } from 'zod'
import { Entry } from './Entry'

export const PageSectionEntry = Entry.extend({
	section: z.string().nonempty()
})

export type PageSectionEntry = z.infer<typeof PageSectionEntry>
