/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_2653269516')

		// update field
		collection.fields.addAt(
			4,
			new Field({
				cascadeDelete: true,
				collectionId: 'pbc_2653269516',
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
		const collection = app.findCollectionByNameOrId('pbc_2653269516')

		// update field
		collection.fields.addAt(
			4,
			new Field({
				cascadeDelete: false,
				collectionId: 'pbc_2653269516',
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
