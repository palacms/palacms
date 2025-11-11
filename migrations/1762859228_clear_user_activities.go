package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// Clear all user_activities records to fix any malformed data
		// These are ephemeral records that track who's currently editing, safe to clear
		_, err := app.DB().NewQuery("DELETE FROM user_activities").Execute()
		return err
	}, func(app core.App) error {
		// No rollback needed - clearing ephemeral data
		return nil
	})
}
