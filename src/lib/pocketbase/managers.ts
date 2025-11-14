import { createCollectionManager } from './CollectionManager'
import { self as this_instance, marketplace as marketplace_instance } from './instances'

export const self = createCollectionManager(this_instance)
export const activity = createCollectionManager(this_instance)
export const marketplace = createCollectionManager(marketplace_instance)
