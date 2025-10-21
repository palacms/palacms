import PocketBase from 'pocketbase'
import { createCollectionManager } from './CollectionManager'

export const self = createCollectionManager(new PocketBase(import.meta.env.DEV ? 'http://127.0.0.1:8090' : location.origin))
export const marketplace = createCollectionManager(new PocketBase('https://marketplace.palacms.com'))
