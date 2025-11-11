package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("sites")
		if err != nil {
			return err
		}

		// Fix the listRule to properly check site_role_assignments
		// Use :each to check if site id appears in role assignments for the current user
		listRule := "(@request.auth.serverRole != \"\") || (id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		viewRule := "(@request.auth.serverRole != \"\") || (id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		collection.ListRule = &listRule
		collection.ViewRule = &viewRule

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("sites")
		if err != nil {
			return err
		}

		// Revert to old rule
		oldListRule := "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)"
		oldViewRule := "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)"
		collection.ListRule = &oldListRule
		collection.ViewRule = &oldViewRule

		return app.Save(collection)
	})
}
