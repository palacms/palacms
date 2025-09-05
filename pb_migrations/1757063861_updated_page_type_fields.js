/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_1424058439')

		// update collection data
		unmarshal(
			{
				indexes: ['CREATE UNIQUE INDEX `idx_SCEvSMYGvw` ON `page_type_fields` (\n  `key`,\n  `page_type`,\n  `parent`\n)']
			},
			collection
		)

		// update field
		collection.fields.addAt(
			5,
			new Field({
				cascadeDelete: true,
				collectionId: 'pbc_1424058439',
				hidden: false,
				id: 'relation1032740943',
				maxSelect: 1,
				minSelect: 0,
				name: 'parent',
				presentable: false,
				required: false,
				system: false,
				type: 'relation'
			})
		)

		return app.save(collection)
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_1424058439')

		// update collection data
		unmarshal(
			{
				indexes: ['CREATE UNIQUE INDEX `idx_SCEvSMYGvw` ON `page_type_fields` (\n  `key`,\n  `page_type`\n)']
			},
			collection
		)

		// update field
		collection.fields.addAt(
			5,
			new Field({
				cascadeDelete: false,
				collectionId: 'pbc_1424058439',
				hidden: false,
				id: 'relation1032740943',
				maxSelect: 1,
				minSelect: 0,
				name: 'parent',
				presentable: false,
				required: false,
				system: false,
				type: 'relation'
			})
		)

		return app.save(collection)
	}
)
