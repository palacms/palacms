// @ts-check
/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration to add index field to pages table and populate existing pages with proper indexes
 */
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('pages')
		console.log({ collection })

		// Add index field
		collection.fields.addAt(
			collection.fields.length,
			new Field({
				hidden: false,
				id: 'index_field_123456',
				name: 'index',
				presentable: false,
				required: false,
				system: false,
				type: 'number'
			})
		)

		app.save(collection)

		// Set all existing pages to index 0
		try {
			app.db().newQuery("UPDATE pages SET `index` = 0").execute()
		} catch (e) {
			// No pages exist yet, which is fine for a fresh database
			console.log('No existing pages to update:', e)
		}
	},
	(app) => {
		// Rollback: remove the index field
		const collection = app.findCollectionByNameOrId('pages')

		// Remove the index field
		collection.fields.removeById('index_field_123456')

		return app.save(collection)
	}
)
