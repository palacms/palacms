/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('site_symbol_fields')
		if (!collection) {
			return null
		}

		// update field
		const field = collection.fields.getById('text245846248')
		if (field) {
			field.required = false
			return app.save(collection)
		}
		return null
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('site_symbol_fields')
		if (!collection) {
			return null
		}

		// revert field
		const field = collection.fields.getById('text245846248')
		if (field) {
			field.required = true
			return app.save(collection)
		}
		return null
	}
)