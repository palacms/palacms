/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const collection = new Collection({
			createRule: null,
			deleteRule: null,
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
					hidden: false,
					id: 'select2324736937',
					maxSelect: 1,
					name: 'key',
					presentable: false,
					required: true,
					system: false,
					type: 'select',
					values: ['instance_id']
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text494360628',
					max: 0,
					min: 0,
					name: 'value',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
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
			id: 'pbc_1721819618',
			indexes: ['CREATE UNIQUE INDEX `idx_nG5w6epnF4` ON `telemetry_values` (`key`)'],
			listRule: null,
			name: 'telemetry_values',
			system: false,
			type: 'base',
			updateRule: null,
			viewRule: null
		})

		return app.save(collection)
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('pbc_1721819618')

		return app.delete(collection)
	}
)
