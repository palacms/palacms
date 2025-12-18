import PocketBase from 'pocketbase'

export const self = new PocketBase(import.meta.env.DEV ? 'http://127.0.0.1:8090' : location.origin)
export const marketplace = new PocketBase('https://marketplace.palacms.com')
