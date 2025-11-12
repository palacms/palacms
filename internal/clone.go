package internal

import (
	"encoding/json"
	"fmt"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

type CloneRequest struct {
	StarterID   string `json:"starter_id"`
	BundleURL   string `json:"bundle_url"`
	SiteName    string `json:"site_name"`
	SiteHost    string `json:"site_host"`
	SiteGroupID string `json:"site_group_id"`
}

type CloneResponse struct {
	SiteID string `json:"site_id"`
}

func cloneSiteFromBundle(app core.App, req CloneRequest) (*CloneResponse, error) {
	// Load bundle from filesystem
	system, err := app.NewFilesystem()
	if err != nil {
		return nil, fmt.Errorf("failed to get filesystem: %w", err)
	}
	defer system.Close()

	bundleKey := "starters/" + req.StarterID + ".json"
	reader, err := system.GetFile(bundleKey)
	if err != nil {
		return nil, fmt.Errorf("failed to load bundle: %w", err)
	}
	defer reader.Close()

	// Parse bundle
	var bundle StarterBundle
	if err := json.NewDecoder(reader).Decode(&bundle); err != nil {
		return nil, fmt.Errorf("failed to parse bundle: %w", err)
	}

	// Create ID mappings for remapping foreign keys
	idMaps := make(map[string]map[string]string)
	collections := []string{
		"site_fields", "site_entries", "site_uploads", "site_symbols",
		"site_symbol_fields", "site_symbol_entries",
		"page_types", "page_type_fields", "page_type_entries",
		"page_type_sections", "page_type_section_entries", "page_type_symbols",
		"pages", "page_entries", "page_sections", "page_section_entries",
	}
	for _, collName := range collections {
		idMaps[collName] = make(map[string]string)
	}

	// Create site
	siteCollection, err := app.FindCollectionByNameOrId("sites")
	if err != nil {
		return nil, fmt.Errorf("failed to find sites collection: %w", err)
	}

	siteRecord := core.NewRecord(siteCollection)
	siteData := bundle.Site

	// Set site fields
	for k, v := range siteData {
		if k == "id" || k == "preview" {
			continue
		}
		siteRecord.Set(k, v)
	}
	siteRecord.Set("name", req.SiteName)
	siteRecord.Set("host", req.SiteHost)
	siteRecord.Set("group", req.SiteGroupID)
	siteRecord.Set("description", "")
	siteRecord.Set("index", 0)

	if err := app.Save(siteRecord); err != nil {
		return nil, fmt.Errorf("failed to save site: %w", err)
	}

	newSiteID := siteRecord.Id

	// Helper to create records with parent/child hierarchy
	createRecordsHierarchical := func(collectionName string, records []interface{}, parentField string, relationFields map[string]string) error {
		if len(records) == 0 {
			return nil
		}

		collection, err := app.FindCollectionByNameOrId(collectionName)
		if err != nil {
			return err
		}

		// Process records in hierarchy order (parents first)
		var processRecords func(parentID string) error
		processRecords = func(parentID string) error {
			for _, recordData := range records {
				data := recordData.(map[string]interface{})
				oldID := data["id"].(string)

				// Check if this record's parent matches what we're processing
				recordParent := ""
				if parentVal, ok := data[parentField]; ok && parentVal != nil {
					if strVal, ok := parentVal.(string); ok {
						recordParent = strVal
					}
				}

				if (parentID == "" && recordParent == "") || (parentID != "" && recordParent == parentID) {
					record := core.NewRecord(collection)

					// Set fields with remapped foreign keys
					for k, v := range data {
						if k == "id" {
							continue
						}
						// Skip file fields - they'll be regenerated on publish
						if k == "compiled_html" || k == "compiled_js" || k == "preview" || k == "file" {
							continue
						}
						if k == "site" {
							record.Set(k, newSiteID)
						} else if remapField, ok := relationFields[k]; ok {
							if strVal, ok := v.(string); ok && strVal != "" {
								if newID, ok := idMaps[remapField][strVal]; ok {
									record.Set(k, newID)
								}
							}
						} else if k == parentField && recordParent != "" {
							if newID, ok := idMaps[collectionName][recordParent]; ok {
								record.Set(k, newID)
							}
						} else {
							record.Set(k, v)
						}
					}

					if err := app.Save(record); err != nil {
						return fmt.Errorf("failed to save %s: %w", collectionName, err)
					}

					idMaps[collectionName][oldID] = record.Id

					// Process children
					if err := processRecords(oldID); err != nil {
						return err
					}
				}
			}
			return nil
		}

		return processRecords("")
	}

	// Create site symbols (no dependencies)
	if records, ok := bundle.Records["site_symbols"]; ok && records != nil {
		if err := createRecordsHierarchical("site_symbols", records, "parent", map[string]string{}); err != nil {
			return nil, err
		}
	}

	// Create page types (no dependencies)
	if records, ok := bundle.Records["page_types"]; ok && records != nil {
		if err := createRecordsHierarchical("page_types", records, "parent", map[string]string{}); err != nil {
			return nil, err
		}
	}

	// Create site fields (hierarchical)
	if records, ok := bundle.Records["site_fields"]; ok && records != nil {
		if err := createRecordsHierarchical("site_fields", records, "parent", map[string]string{}); err != nil {
			return nil, err
		}
	}

	// Create site symbol fields (hierarchical)
	if records, ok := bundle.Records["site_symbol_fields"]; ok && records != nil {
		if err := createRecordsHierarchical("site_symbol_fields", records, "parent", map[string]string{
			"symbol": "site_symbols",
		}); err != nil {
			return nil, err
		}
	}

	// Create page type fields (hierarchical)
	if records, ok := bundle.Records["page_type_fields"]; ok && records != nil {
		if err := createRecordsHierarchical("page_type_fields", records, "parent", map[string]string{
			"page_type": "page_types",
		}); err != nil {
			return nil, err
		}
	}

	// Create page type symbols
	if records, ok := bundle.Records["page_type_symbols"]; ok && records != nil {
		if err := createRecordsHierarchical("page_type_symbols", records, "parent", map[string]string{
			"page_type": "page_types",
			"symbol":    "site_symbols",
		}); err != nil {
			return nil, err
		}
	}

	// Create page type sections
	if records, ok := bundle.Records["page_type_sections"]; ok && records != nil {
		if err := createRecordsHierarchical("page_type_sections", records, "parent", map[string]string{
			"page_type": "page_types",
			"symbol":    "site_symbols",
		}); err != nil {
			return nil, err
		}
	}

	// Create pages (hierarchical)
	if records, ok := bundle.Records["pages"]; ok && records != nil {
		if err := createRecordsHierarchical("pages", records, "parent", map[string]string{
			"page_type": "page_types",
		}); err != nil {
			return nil, err
		}
	}

	// Create page sections
	if records, ok := bundle.Records["page_sections"]; ok && records != nil {
		if err := createRecordsHierarchical("page_sections", records, "parent", map[string]string{
			"page":   "pages",
			"symbol": "site_symbols",
		}); err != nil {
			return nil, err
		}
	}

	// Create entries (hierarchical, after fields are created)
	entryCollections := []struct {
		name         string
		fieldRelMap  string
		fieldRelName string
	}{
		{"site_entries", "site_fields", "field"},
		{"site_symbol_entries", "site_symbol_fields", "field"},
		{"page_type_entries", "page_type_fields", "field"},
		{"page_type_section_entries", "site_symbol_fields", "field"},
		{"page_entries", "page_type_fields", "field"},
		{"page_section_entries", "site_symbol_fields", "field"},
	}

	for _, entryInfo := range entryCollections {
		if records, ok := bundle.Records[entryInfo.name]; ok && records != nil {
			relationFields := map[string]string{
				entryInfo.fieldRelName: entryInfo.fieldRelMap,
			}
			// Add section relation for section entries
			if entryInfo.name == "page_type_section_entries" {
				relationFields["section"] = "page_type_sections"
			}
			if entryInfo.name == "page_section_entries" {
				relationFields["section"] = "page_sections"
			}
			if entryInfo.name == "page_entries" {
				relationFields["page"] = "pages"
			}

			if err := createRecordsHierarchical(entryInfo.name, records, "parent", relationFields); err != nil {
				return nil, err
			}
		}
	}

	// Skip site uploads - files can't be cloned easily
	// Users can re-upload files if needed
	// TODO: Implement file downloads and re-uploads if this becomes important

	return &CloneResponse{SiteID: newSiteID}, nil
}

func RegisterCloneEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/palacms/clone-starter", func(requestEvent *core.RequestEvent) error {
			var req CloneRequest
			if err := requestEvent.BindBody(&req); err != nil {
				return requestEvent.BadRequestError("Invalid request body", err)
			}

			if req.StarterID == "" || req.SiteName == "" || req.SiteHost == "" || req.SiteGroupID == "" {
				return requestEvent.BadRequestError("Missing required fields", nil)
			}

			// TODO: Re-enable authentication before production
			// info, err := requestEvent.RequestInfo()
			// if err != nil {
			// 	return err
			// }
			// Check permissions...

			response, err := cloneSiteFromBundle(requestEvent.App, req)
			if err != nil {
				return requestEvent.BadRequestError("Failed to clone site", err)
			}

			return requestEvent.JSON(200, response)
		})
		return serveEvent.Next()
	})

	return nil
}
