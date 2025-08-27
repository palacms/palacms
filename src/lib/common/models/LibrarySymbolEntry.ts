import { z } from 'zod'
import { Entry } from './Entry'

export const LibrarySymbolEntry = Entry

export type LibrarySymbolEntry = z.infer<typeof LibrarySymbolEntry>
