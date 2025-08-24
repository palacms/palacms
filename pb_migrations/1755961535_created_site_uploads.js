/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = new Collection({
			createRule: '(@request.auth.serverRole != "") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)',
			deleteRule: '(@request.auth.serverRole != "") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)',
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text3208210256',
					max: 15,
					min: 15,
					name: 'id',
					pattern: '^[a-z0-9]+$',
					presentable: false,
					primaryKey: true,
					required: true,
					system: true,
					type: 'text'
				},
				{
					cascadeDelete: true,
					collectionId: 'pbc_2001081480',
					hidden: false,
					id: 'relation1766001124',
					maxSelect: 1,
					minSelect: 0,
					name: 'site',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					hidden: false,
					id: 'file2359244304',
					maxSelect: 1,
					maxSize: 0,
					mimeTypes: [],
					name: 'file',
					presentable: false,
					protected: false,
					required: true,
					system: false,
					thumbs: [],
					type: 'file'
				},
				{
					hidden: false,
					id: 'autodate2990389176',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate3332085495',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			],
			id: 'pbc_1021288652',
			indexes: [],
			listRule: '(@request.auth.serverRole != "") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)',
			name: 'site_uploads',
			system: false,
			type: 'base',
			updateRule: '(@request.auth.serverRole != "") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)',
			viewRule: '(@request.auth.serverRole != "") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)'
		})

		return app.save(collection)
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_1021288652')

		return app.delete(collection)
	}
)
