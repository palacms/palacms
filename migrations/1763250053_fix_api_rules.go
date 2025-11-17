package migrations

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	strPtr := func(s string) *string {
		return &s
	}

	m.Register(
		func(app core.App) error {
			type apiRuleUpdateSpec struct {
				CollectionName string
				SiteIDField    string
				ValidationRule string
				OwnedByUser    bool
				Immutable      bool
			}

			specs := []apiRuleUpdateSpec{
				{CollectionName: "sites", SiteIDField: "id"},
				{CollectionName: "page_types", SiteIDField: "site.id"},
				{CollectionName: "site_fields", SiteIDField: "site.id"},
				{CollectionName: "site_symbols", SiteIDField: "site.id"},
				{CollectionName: "site_uploads", SiteIDField: "site.id"},
				{CollectionName: "site_snapshots", SiteIDField: "site.id", Immutable: true},
				{CollectionName: "user_activities", SiteIDField: "site.id", OwnedByUser: true},
				{CollectionName: "pages", SiteIDField: "site.id", ValidationRule: "page_type.site.id = site.id && (parent = \"\" || parent.site.id = site.id)"},
				{CollectionName: "page_sections", SiteIDField: "symbol.site.id"},
				{CollectionName: "site_symbol_fields", SiteIDField: "symbol.site.id"},
				{CollectionName: "page_type_fields", SiteIDField: "page_type.site.id"},
				{CollectionName: "page_type_sections", SiteIDField: "page_type.site.id", ValidationRule: "symbol.site.id = page_type.site.id"},
				{CollectionName: "page_type_symbols", SiteIDField: "page_type.site.id", ValidationRule: "symbol.site.id = page_type.site.id"},
				{CollectionName: "page_entries", SiteIDField: "page.site.id", ValidationRule: "field.page_type.id = page.page_type"},
				{CollectionName: "site_entries", SiteIDField: "field.site.id"},
				{CollectionName: "site_symbol_entries", SiteIDField: "field.symbol.site.id"},
				{CollectionName: "page_type_entries", SiteIDField: "field.page_type.site.id"},
				{CollectionName: "page_section_entries", SiteIDField: "section.page.site.id", ValidationRule: "field.symbol.id = section.symbol.id"},
				{CollectionName: "page_type_section_entries", SiteIDField: "section.symbol.site.id", ValidationRule: "field.symbol.id = section.symbol.id"},
			}
			baseRuleTemplate := "%s((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id ?= @request.auth.id && @collection.site_role_assignments.site.id ?= %s))"
			ownerRule := "(@request.auth.id = user.id)"

			for _, spec := range specs {
				collection, err := app.FindCollectionByNameOrId(spec.CollectionName)
				if err != nil {
					return err
				}

				modifyPrefix := spec.ValidationRule
				if modifyPrefix != "" {
					modifyPrefix = "(" + modifyPrefix + ") && "
				}

				baseRule := fmt.Sprintf(baseRuleTemplate, "", spec.SiteIDField)
				modifyRule := fmt.Sprintf(baseRuleTemplate, modifyPrefix, spec.SiteIDField)

				collection.ViewRule = strPtr(baseRule)
				collection.ListRule = strPtr(baseRule)
				collection.CreateRule = strPtr(modifyRule)
				collection.UpdateRule = strPtr(modifyRule)
				collection.DeleteRule = strPtr(baseRule)

				if spec.OwnedByUser {
					collection.UpdateRule = strPtr(ownerRule)
					collection.DeleteRule = strPtr(ownerRule)
				}

				if spec.Immutable {
					collection.UpdateRule = nil
				}

				if err := app.Save(collection); err != nil {
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
