import { z } from 'zod'
import { Entry } from './Entry'

export const PageTypeSectionEntry = Entry.extend({
	section: z.string().nonempty()
})

export type PageTypeSectionEntry = z.infer<typeof PageTypeSectionEntry>
