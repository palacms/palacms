/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
	const settings = app.settings()
	const appURL = $os.getenv('PALA_APP_URL')
	if (appURL) {
		settings.meta.appURL = appURL
	}

	settings.meta.appName = 'PalaCMS'
	app.save(settings)

	const superuserEmail = $os.getenv('PALA_SUPERUSER_EMAIL')
	const superuserPassword = $os.getenv('PALA_SUPERUSER_PASSWORD')
	if (superuserEmail && superuserPassword) {
		const collection = app.findCollectionByNameOrId('_superusers')
		const record = new Record(collection)
		record.set('email', superuserEmail)
		record.set('password', superuserPassword)
		app.save(record)
	}

	const userEmail = $os.getenv('PALA_USER_EMAIL')
	const userPassword = $os.getenv('PALA_USER_PASSWORD')
	if (userEmail && userPassword) {
		const collection = app.findCollectionByNameOrId('users')
		const record = new Record(collection)
		record.set('email', userEmail)
		record.set('password', userPassword)
		record.set('name', 'Test User')
		record.set('serverRole', 'developer')
		app.save(record)
	}
})
