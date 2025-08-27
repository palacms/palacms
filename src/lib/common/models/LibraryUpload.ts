import { z } from 'zod'
import { Upload } from './Upload'

export const LibraryUpload = Upload

export type LibraryUpload = z.infer<typeof LibraryUpload>
