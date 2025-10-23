package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func create_users_activity_collection(app core.App) error {
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

	siteSymbols, err := app.FindCollectionByNameOrId("site_symbols")
	if err != nil {
		return err
	}

	baseRule := "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)"
	modifyRule := "@request.auth.id = user.id"

	userActivities := core.NewCollection("base", "user_activities")
	userActivities.ListRule = &baseRule
	userActivities.ViewRule = &baseRule
	userActivities.CreateRule = &baseRule
	userActivities.UpdateRule = &modifyRule
	userActivities.DeleteRule = &modifyRule
	userActivities.Fields.Add(
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
		&core.RelationField{
			Name:          "site_symbol",
			CollectionId:  siteSymbols.Id,
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
	userActivities.Indexes = append(userActivities.Indexes, "CREATE UNIQUE INDEX `idx_5JgrMbxAMw` ON `user_activities` (`user`)")
	return app.Save(userActivities)
}

func update_users_collection(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}

	showRule := "@request.auth.serverRole != '' || id = @request.auth.id"
	createRule := "@request.auth.serverRole != ''"
	modifyRule := "@request.auth.serverRole != '' || id = @request.auth.id"
	users.ListRule = &showRule
	users.ViewRule = &showRule
	users.CreateRule = &createRule
	users.UpdateRule = &modifyRule
	users.DeleteRule = &modifyRule

	return app.Save(users)
}

func create_collaborator_view(app core.App) error {
	collaborators := core.NewViewCollection("collaborators")
	collaborators.ViewQuery = "select users.id, users.email, users.name, users.`serverRole`, users.avatar from users"

	showRule := "@request.auth.id != ''"
	collaborators.ListRule = &showRule
	collaborators.ViewRule = &showRule

	return app.Save(collaborators)
}

func init() {
	m.Register(
		func(app core.App) error {
			if err := create_users_activity_collection(app); err != nil {
				return err
			}
			if err := update_users_collection(app); err != nil {
				return err
			}
			if err := create_collaborator_view(app); err != nil {
				return err
			}
			return nil
		},
		func(app core.App) error {
			return nil
		},
	)
}
