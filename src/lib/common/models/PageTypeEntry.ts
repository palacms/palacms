import { z } from 'zod'
import { Entry } from './Entry'

export const PageTypeEntry = Entry

export type PageTypeEntry = z.infer<typeof PageTypeEntry>
