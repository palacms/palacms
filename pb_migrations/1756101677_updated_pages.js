/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3945946014")

  // update field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "index_field_123456",
    "max": null,
    "min": 0,
    "name": "index",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3945946014")

  // update field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "index_field_123456",
    "max": null,
    "min": null,
    "name": "index",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
