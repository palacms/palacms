import { z } from 'zod'
import { Upload } from './Upload'

export const SiteUpload = Upload.extend({
	site: z.string().nonempty()
})

export type SiteUpload = z.infer<typeof SiteUpload>
