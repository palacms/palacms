package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("pbc_1721819618")
			if err != nil {
				return err
			}

			// Rename collection
			collection.Name = "config_values"

			if err := app.Save(collection); err != nil {
				return err
			}

			return nil
		},
		func(app core.App) error {
			return nil
		},
	)
}
