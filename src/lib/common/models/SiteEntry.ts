import { z } from 'zod'
import { Entry } from './Entry'

export const SiteEntry = Entry

export type SiteEntry = z.infer<typeof SiteEntry>
