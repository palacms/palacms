package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collections := []struct {
			name     string
			sitePath string // path to site id in the collection
		}{
			{"sites", "id"},
			{"site_fields", "site.id"},
			{"site_entries", "field.site.id"},
			{"site_symbols", "site.id"},
			{"site_symbol_fields", "symbol.site.id"},
			{"site_symbol_entries", "field.symbol.site.id"},
			{"page_types", "site.id"},
			{"page_type_symbols", "page_type.site.id"},
			{"page_type_sections", "page_type.site.id"},
			{"page_type_section_entries", "section.symbol.site.id"},
			{"pages", "site.id"},
			{"page_sections", "page.site.id"},
			{"page_section_entries", "section.page.site.id"},
			{"page_type_fields", "page_type.site.id"},
			{"page_type_entries", "field.page_type.site.id"},
			{"page_entries", "page.site.id"},
			{"site_uploads", "site.id"},
		}

		for _, col := range collections {
			collection, err := app.FindCollectionByNameOrId(col.name)
			if err != nil {
				return err
			}

			// Fix the listRule and viewRule to properly check site_role_assignments
			listRule := "(@request.auth.serverRole != \"\") || (" + col.sitePath + " ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
			viewRule := "(@request.auth.serverRole != \"\") || (" + col.sitePath + " ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
			collection.ListRule = &listRule
			collection.ViewRule = &viewRule

			if err := app.Save(collection); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		collections := []struct {
			name     string
			sitePath string
		}{
			{"sites", "id"},
			{"site_fields", "site.id"},
			{"site_entries", "field.site.id"},
			{"site_symbols", "site.id"},
			{"site_symbol_fields", "symbol.site.id"},
			{"site_symbol_entries", "field.symbol.site.id"},
			{"page_types", "site.id"},
			{"page_type_symbols", "page_type.site.id"},
			{"page_type_sections", "page_type.site.id"},
			{"page_type_section_entries", "section.symbol.site.id"},
			{"pages", "site.id"},
			{"page_sections", "page.site.id"},
			{"page_section_entries", "section.page.site.id"},
			{"page_type_fields", "page_type.site.id"},
			{"page_type_entries", "field.page_type.site.id"},
			{"page_entries", "page.site.id"},
			{"site_uploads", "site.id"},
		}

		for _, col := range collections {
			collection, err := app.FindCollectionByNameOrId(col.name)
			if err != nil {
				return err
			}

			// Revert to old rule
			oldListRule := "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = " + col.sitePath + ")"
			oldViewRule := "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = " + col.sitePath + ")"
			collection.ListRule = &oldListRule
			collection.ViewRule = &oldViewRule

			if err := app.Save(collection); err != nil {
				return err
			}
		}

		return nil
	})
}
