package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("sites")
			if err != nil {
				return err
			}

			// Add the Cloudflare deployment fields
			collection.Fields.Add(
				&core.TextField{
					Name:     "cfAccountId",
					Required: false,
				},
				&core.TextField{
					Name:     "cfProjectName",
					Required: false,
				},
				&core.TextField{
					Name:     "cfApiToken",
					Required: false,
					Hidden:   true,
				},
			)

			return app.Save(collection)
		},
		func(app core.App) error {
			collection, err := app.FindCollectionByNameOrId("sites")
			if err != nil {
				return err
			}

			// Remove the Cloudflare deployment fields
			collection.Fields.RemoveByName("cfAccountId")
			collection.Fields.RemoveByName("cfProjectName")
			collection.Fields.RemoveByName("cfApiToken")

			return app.Save(collection)
		},
	)
}
