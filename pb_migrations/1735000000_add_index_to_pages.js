// @ts-check
/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration to add index field to pages table and populate existing pages with proper indexes
 */
migrate((app) => {
	const collection = app.findCollectionByNameOrId("pages")

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
	const pages = app.findRecordsByFilter("pages", "", "", 500)
	pages.forEach(page => {
		page.set("index", 0)
		app.save(page)
	})
}, (app) => {
	// Rollback: remove the index field
	const collection = app.findCollectionByNameOrId("pages")
	
	// Remove the index field
	collection.fields.removeById('index_field_123456')
	
	return app.save(collection)
})