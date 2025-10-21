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

			sites, err := app.FindCollectionByNameOrId("sites")
			if err != nil {
				return err
			}

			pages, err := app.FindCollectionByNameOrId("pages")
			if err != nil {
				return err
			}

			pageTypes, err := app.FindCollectionByNameOrId("page_types")
			if err != nil {
				return err
			}

			baseRule := "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)"
			modifyRule := "@request.auth.id = user.id"

			collection := core.NewCollection("base", "user_activities")
			collection.ListRule = &baseRule
			collection.ViewRule = &baseRule
			collection.CreateRule = &baseRule
			collection.UpdateRule = &modifyRule
			collection.DeleteRule = &modifyRule
			collection.Fields.Add(
				&core.TextField{
					Name:                "id",
					Min:                 15,
					Max:                 15,
					Pattern:             "^[a-z0-9]+$",
					AutogeneratePattern: "[a-z0-9]{15}",
					System:              true,
					Required:            true,
					PrimaryKey:          true,
				},
				&core.RelationField{
					Name:          "user",
					CollectionId:  users.Id,
					CascadeDelete: true,
					Required:      true,
				},
				&core.RelationField{
					Name:          "site",
					CollectionId:  sites.Id,
					CascadeDelete: true,
					Required:      true,
				},
				&core.RelationField{
					Name:          "page_type",
					CollectionId:  pageTypes.Id,
					CascadeDelete: true,
				},
				&core.RelationField{
					Name:          "page",
					CollectionId:  pages.Id,
					CascadeDelete: true,
				},
				&core.AutodateField{
					Name:     "created",
					OnCreate: true,
					OnUpdate: false,
					System:   true,
				},
				&core.AutodateField{
					Name:     "updated",
					OnCreate: true,
					OnUpdate: true,
					System:   true,
				},
			)
			collection.Indexes = append(collection.Indexes, "CREATE UNIQUE INDEX `idx_5JgrMbxAMw` ON `user_activities` (`user`)")
			return app.Save(collection)
		},
		func(app core.App) error {
			return nil
		},
	)
}
