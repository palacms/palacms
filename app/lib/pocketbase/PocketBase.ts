import PocketBase from 'pocketbase'

export const self = new PocketBase(import.meta.env.DEV ? 'http://127.0.0.1:8090' : '/')
export const marketplace = new PocketBase('https://marketplace.palacms.com')

export const checkSession = async () => {
	if (self.authStore.isValid) {
		return self
			.collection('users')
			.authRefresh()
			.then(() => true)
			.catch(() => {
				self.authStore.clear()
				return false
			})
	} else {
		return false
	}
}
