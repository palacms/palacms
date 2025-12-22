package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			settings := app.Settings()
			if settings.Batch.MaxRequests != 50 {
				// Not using default batch size, leave it unchanged
				return nil
			}

			// Set batch size to 20 requests/batch
			settings.Batch.MaxRequests = 20
			return app.Save(settings)
		},
		func(app core.App) error {
			return nil
		},
	)
}
