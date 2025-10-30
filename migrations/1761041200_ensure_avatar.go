package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			users, err := app.FindCollectionByNameOrId("users")
			if err != nil {
				return err
			}

			avatar := users.Fields.GetByName("avatar")
			if avatar == nil {
				users.Fields.Add(&core.FileField{
					Name: "avatar",
					MimeTypes: []string{
						"image/jpeg",
						"image/png",
						"image/svg+xml",
						"image/gif",
						"image/webp",
					},
				})
				if err := app.Save(users); err != nil {
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
