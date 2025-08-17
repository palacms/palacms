/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('users')

		// Update create rule to allow creating users when no users exist
		// Save the original rule first
		const originalCreateRule = collection.createRule
		
		// Set new rule: allow if authenticated with serverRole OR if no users exist
		collection.createRule = originalCreateRule + ' || @collection.users.id ?= ""'

		return app.save(collection)
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('users')

		// Revert to stricter rule - this will be run manually after first user is created
		collection.createRule = "@request.auth.serverRole != ''"

		return app.save(collection)
	}
)