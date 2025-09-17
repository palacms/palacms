package migrations

import (
	"os"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			settings := app.Settings()
			appURL := os.Getenv("PALA_APP_URL")
			if appURL != "" {
				settings.Meta.AppURL = appURL
			}

			settings.Meta.AppName = "PalaCMS"
			app.Save(settings)

			superuserEmail := os.Getenv("PALA_SUPERUSER_EMAIL")
			superuserPassword := os.Getenv("PALA_SUPERUSER_PASSWORD")
			if superuserEmail != "" && superuserPassword != "" {
				collection, err := app.FindCollectionByNameOrId("_superusers")
				if err != nil {
					return err
				}

				record := core.NewRecord(collection)
				record.Set("email", superuserEmail)
				record.Set("password", superuserPassword)
				app.Save(record)
			}

			userEmail := os.Getenv("PALA_USER_EMAIL")
			userPassword := os.Getenv("PALA_USER_PASSWORD")
			if userEmail != "" && userPassword != "" {
				collection, err := app.FindCollectionByNameOrId("users")
				if err != nil {
					return err
				}

				record := core.NewRecord(collection)
				record.Set("email", userEmail)
				record.Set("password", userPassword)
				record.Set("name", "Test User")
				record.Set("serverRole", "developer")
				record.SetVerified(true)
				app.Save(record)
			}

			return nil
		},
		func(app core.App) error {
			return nil
		},

		// Use old filename to ensure that the migration will not be redone on existing installations.
		"1754640604_settings.js",
	)
}
