/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_149684058")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_FAyFVAS8Jh` ON `site_symbol_fields` (\n  `key`,\n  `symbol`,\n  `parent`\n)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_149684058")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_FAyFVAS8Jh` ON `site_symbol_fields` (\n  `key`,\n  `symbol`\n)"
    ]
  }, collection)

  return app.save(collection)
})
