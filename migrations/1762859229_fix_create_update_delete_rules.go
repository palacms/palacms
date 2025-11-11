package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// Fix createRule, updateRule, and deleteRule for collections with site_role_assignments checks

		// pages collection
		pages, err := app.FindCollectionByNameOrId("pages")
		if err != nil {
			return err
		}
		pagesCreateRule := "(page_type.site.id = site.id && (parent = \"\" || parent.site.id = site.id)) && ((@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each))"
		pagesUpdateRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		pagesDeleteRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		pages.CreateRule = &pagesCreateRule
		pages.UpdateRule = &pagesUpdateRule
		pages.DeleteRule = &pagesDeleteRule
		if err := app.Save(pages); err != nil {
			return err
		}

		// page_sections collection
		pageSections, err := app.FindCollectionByNameOrId("page_sections")
		if err != nil {
			return err
		}
		pageSectionsCreateRule := "(symbol.site.id = page.site.id) && ((@request.auth.serverRole != \"\") || (page.site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each))"
		pageSectionsUpdateRule := "(@request.auth.serverRole != \"\") || (page.site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		pageSectionsDeleteRule := "(@request.auth.serverRole != \"\") || (page.site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		pageSections.CreateRule = &pageSectionsCreateRule
		pageSections.UpdateRule = &pageSectionsUpdateRule
		pageSections.DeleteRule = &pageSectionsDeleteRule
		if err := app.Save(pageSections); err != nil {
			return err
		}

		// site_symbols collection
		siteSymbols, err := app.FindCollectionByNameOrId("site_symbols")
		if err != nil {
			return err
		}
		siteSymbolsCreateRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		siteSymbolsUpdateRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		siteSymbolsDeleteRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		siteSymbols.CreateRule = &siteSymbolsCreateRule
		siteSymbols.UpdateRule = &siteSymbolsUpdateRule
		siteSymbols.DeleteRule = &siteSymbolsDeleteRule
		if err := app.Save(siteSymbols); err != nil {
			return err
		}

		// site_fields collection
		siteFields, err := app.FindCollectionByNameOrId("site_fields")
		if err != nil {
			return err
		}
		siteFieldsCreateRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		siteFieldsUpdateRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		siteFieldsDeleteRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		siteFields.CreateRule = &siteFieldsCreateRule
		siteFields.UpdateRule = &siteFieldsUpdateRule
		siteFields.DeleteRule = &siteFieldsDeleteRule
		if err := app.Save(siteFields); err != nil {
			return err
		}

		// page_types collection
		pageTypes, err := app.FindCollectionByNameOrId("page_types")
		if err != nil {
			return err
		}
		pageTypesCreateRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		pageTypesUpdateRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		pageTypesDeleteRule := "(@request.auth.serverRole != \"\") || (site.id ?= @collection.site_role_assignments.site.id:each && @request.auth.id ?= @collection.site_role_assignments.user.id:each)"
		pageTypes.CreateRule = &pageTypesCreateRule
		pageTypes.UpdateRule = &pageTypesUpdateRule
		pageTypes.DeleteRule = &pageTypesDeleteRule
		if err := app.Save(pageTypes); err != nil {
			return err
		}

		return nil
	}, func(app core.App) error {
		// Revert logic would go here if needed
		return nil
	})
}
