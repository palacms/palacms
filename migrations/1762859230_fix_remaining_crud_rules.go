package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collections := []struct {
			name       string
			createPath string
			updatePath string
			deletePath string
		}{
			{"page_entries", "page.site.id", "page.site.id", "page.site.id"},
			{"page_section_entries", "section.page.site.id", "section.page.site.id", "section.page.site.id"},
			{"page_type_entries", "field.page_type.site.id", "field.page_type.site.id", "field.page_type.site.id"},
			{"page_type_fields", "page_type.site.id", "page_type.site.id", "page_type.site.id"},
			{"page_type_section_entries", "section.symbol.site.id", "section.symbol.site.id", "section.symbol.site.id"},
			{"page_type_sections", "page_type.site.id", "page_type.site.id", "page_type.site.id"},
			{"page_type_symbols", "page_type.site.id", "page_type.site.id", "page_type.site.id"},
			{"site_entries", "field.site.id", "field.site.id", "field.site.id"},
			{"site_symbol_entries", "field.symbol.site.id", "field.symbol.site.id", "field.symbol.site.id"},
			{"site_symbol_fields", "symbol.site.id", "symbol.site.id", "symbol.site.id"},
			{"site_uploads", "", "site.id", ""},
		}

		for _, col := range collections {
			collection, err := app.FindCollectionByNameOrId(col.name)
			if err != nil {
				return err
			}

			if col.createPath != "" {
				createRule := "(@request.auth.serverRole != \"\") || (" + col.createPath + " ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
				collection.CreateRule = &createRule
			}

			if col.updatePath != "" {
				updateRule := "(@request.auth.serverRole != \"\") || (" + col.updatePath + " ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
				collection.UpdateRule = &updateRule
			}

			if col.deletePath != "" {
				deleteRule := "(@request.auth.serverRole != \"\") || (" + col.deletePath + " ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
				collection.DeleteRule = &deleteRule
			}

			if err := app.Save(collection); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		// Revert logic would go here if needed
		return nil
	})
}
