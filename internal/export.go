package internal

import (
	"encoding/json"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type StarterBundle struct {
	Version  string                   `json:"version"`
	Metadata StarterBundleMetadata    `json:"metadata"`
	Site     map[string]interface{}   `json:"site"`
	Records  map[string][]interface{} `json:"records"`
}

type StarterBundleMetadata struct {
	StarterID  string    `json:"starter_id"`
	ExportedAt time.Time `json:"exported_at"`
}

func exportStarterBundle(app core.App, siteID string) (*StarterBundle, error) {
	// Fetch site record
	site, err := app.FindRecordById("sites", siteID)
	if err != nil {
		return nil, err
	}

	bundle := &StarterBundle{
		Version: "1.0",
		Metadata: StarterBundleMetadata{
			StarterID:  siteID,
			ExportedAt: time.Now(),
		},
		Site:    recordToMap(site),
		Records: make(map[string][]interface{}),
	}

	// Collection names to export with their filter
	collections := []struct {
		name   string
		filter string
	}{
		{"site_fields", "site = {:site}"},
		{"site_entries", "field.site = {:site}"},
		{"site_uploads", "site = {:site}"},
		{"site_symbols", "site = {:site}"},
		{"site_symbol_fields", "symbol.site = {:site}"},
		{"site_symbol_entries", "field.symbol.site = {:site}"},
		{"page_types", "site = {:site}"},
		{"page_type_fields", "page_type.site = {:site}"},
		{"page_type_entries", "field.page_type.site = {:site}"},
		{"page_type_sections", "page_type.site = {:site}"},
		{"page_type_section_entries", "section.page_type.site = {:site}"},
		{"page_type_symbols", "page_type.site = {:site}"},
		{"pages", "site = {:site}"},
		{"page_entries", "page.site = {:site}"},
		{"page_sections", "page.site = {:site}"},
		{"page_section_entries", "section.page.site = {:site}"},
	}

	// Fetch all related records
	for _, coll := range collections {
		collection, err := app.FindCollectionByNameOrId(coll.name)
		if err != nil {
			return nil, err
		}

		records, err := app.FindRecordsByFilter(
			collection.Id,
			coll.filter,
			"",
			0,
			0,
			dbx.Params{"site": siteID},
		)
		if err != nil {
			return nil, err
		}

		bundle.Records[coll.name] = make([]interface{}, len(records))
		for i, record := range records {
			bundle.Records[coll.name][i] = recordToMap(record)
		}
	}

	return bundle, nil
}

func recordToMap(record *core.Record) map[string]interface{} {
	data := make(map[string]interface{})

	// Copy all fields
	for key, value := range record.PublicExport() {
		data[key] = value
	}

	return data
}

func saveStarterBundle(app core.App, siteID string, bundle *StarterBundle) error {
	// Convert bundle to JSON
	jsonData, err := json.MarshalIndent(bundle, "", "  ")
	if err != nil {
		return err
	}

	// Get filesystem
	system, err := app.NewFilesystem()
	if err != nil {
		return err
	}
	defer system.Close()

	// Save to starters/{site_id}.json
	key := "starters/" + siteID + ".json"

	// Upload the JSON file
	if err := system.Upload(jsonData, key); err != nil {
		return err
	}

	return nil
}

func generateStarterBundle(app core.App, siteID string) error {
	bundle, err := exportStarterBundle(app, siteID)
	if err != nil {
		return err
	}

	return saveStarterBundle(app, siteID, bundle)
}

func RegisterStarterBundleGeneration(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		// Endpoint to serve starter bundle files
		serveEvent.Router.GET("/api/palacms/starters/{id}", func(requestEvent *core.RequestEvent) error {
			siteID := requestEvent.Request.PathValue("id")
			if siteID == "" {
				return requestEvent.BadRequestError("site_id missing", nil)
			}

			// Remove .json extension if present
			if len(siteID) > 5 && siteID[len(siteID)-5:] == ".json" {
				siteID = siteID[:len(siteID)-5]
			}

			system, err := requestEvent.App.NewFilesystem()
			if err != nil {
				return err
			}
			defer system.Close()

			key := "starters/" + siteID + ".json"

			// Check if file exists
			exists, err := system.Exists(key)
			if err != nil || !exists {
				return requestEvent.NotFoundError("Bundle not found", err)
			}

			// Serve the file
			return system.Serve(requestEvent.Response, requestEvent.Request, key, siteID+".json")
		})

		// Manual endpoint for generating/regenerating bundles
		serveEvent.Router.POST("/api/palacms/generate-starter-bundle", func(requestEvent *core.RequestEvent) error {
			body := struct {
				SiteId string `json:"site_id"`
			}{}
			requestEvent.BindBody(&body)

			if body.SiteId == "" {
				return requestEvent.BadRequestError("site_id missing", nil)
			}

			// Verify site exists
			_, err := requestEvent.App.FindRecordById("sites", body.SiteId)
			if err != nil {
				return err
			}

			// TODO: Re-enable authentication before production
			// info, err := requestEvent.RequestInfo()
			// if err != nil {
			// 	return err
			// }
			// canAccess, err := requestEvent.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
			// if !canAccess {
			// 	return requestEvent.ForbiddenError("", err)
			// }

			// Generate bundle in background (don't block response)
			go func() {
				if err := generateStarterBundle(requestEvent.App, body.SiteId); err != nil {
					// Log error but don't fail the response
					requestEvent.App.Logger().Error("Failed to generate starter bundle", "site_id", body.SiteId, "error", err)
				}
			}()

			// Return immediately
			return requestEvent.JSON(200, map[string]string{
				"message":    "Bundle generation started",
				"bundle_url": "/api/palacms/starters/" + body.SiteId + ".json",
			})
		})
		return serveEvent.Next()
	})

	return nil
}
