package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	fieldCollections := []string{
		"library_symbol_fields",
		"page_type_fields",
		"site_fields",
		"site_symbol_fields",
	}

	m.Register(
		func(app core.App) error {
			for _, name := range fieldCollections {
				collection, err := app.FindCollectionByNameOrId(name)
				if err != nil {
					return err
				}

				// Make key field optional
				field := collection.Fields.GetByName("key").(*core.TextField)
				field.Required = false

				// Remove the unique index
				collection.Indexes = types.JSONArray[string]{}

				if err := app.Save(collection); err != nil {
					return err
				}
			}

			return nil
		},
		func(app core.App) error {
			return nil
		},
	)
}
