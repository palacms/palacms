/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_4273630883')

		// update collection data
		unmarshal(
			{
				indexes: ['CREATE UNIQUE INDEX `idx_kzYPeLM7lh` ON `site_fields` (\n  `key`,\n  `site`,\n  `parent`\n)']
			},
			collection
		)

		return app.save(collection)
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_4273630883')

		// update collection data
		unmarshal(
			{
				indexes: ['CREATE UNIQUE INDEX `idx_kzYPeLM7lh` ON `site_fields` (\n  `key`,\n  `site`\n)']
			},
			collection
		)

		return app.save(collection)
	}
)
