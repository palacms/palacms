import { z } from 'zod'
import { Entry } from './Entry'

export const SiteSymbolEntry = Entry

export type SiteSymbolEntry = z.infer<typeof SiteSymbolEntry>
