package internal

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var snapshotSignature = []byte{0x50, 0x41, 0x4C, 0x41, 0x43, 0x4D, 0x53, 0x3A, 0x33, 0x2E, 0x30}

// Helper to safely get string from map
func getStringField(data map[string]interface{}, key string) (string, bool) {
	val, exists := data[key]
	if !exists {
		return "", false
	}
	strVal, ok := val.(string)
	return strVal, ok
}

// Helper to validate parent relationship (detect cycles)
func detectCycle(id string, parentId string, allRecords []map[string]interface{}, visited map[string]bool) bool {
	if visited[parentId] {
		return true
	}
	visited[parentId] = true
	for _, record := range allRecords {
		recordId, ok := getStringField(record, "id")
		if !ok || recordId != parentId {
			continue
		}
		nextParentId, ok := getStringField(record, "parent")
		if !ok || nextParentId == "" {
			return false
		}
		return detectCycle(id, nextParentId, allRecords, visited)
	}
	return false
}

type SnapshotMetadata struct {
	CreatedAt             string `json:"created_at"`
	SourceInstanceId      string `json:"source_instance_id"`
	SourceInstanceVersion string `json:"source_instance_version"`
}

type SnapshotRecords struct {
	Sites                   []map[string]interface{} `json:"sites"`
	SiteUploads             []map[string]interface{} `json:"site_uploads"`
	SiteFields              []map[string]interface{} `json:"site_fields"`
	SiteEntries             []map[string]interface{} `json:"site_entries"`
	SiteSymbols             []map[string]interface{} `json:"site_symbols"`
	SiteSymbolFields        []map[string]interface{} `json:"site_symbol_fields"`
	SiteSymbolEntries       []map[string]interface{} `json:"site_symbol_entries"`
	PageTypes               []map[string]interface{} `json:"page_types"`
	PageTypeFields          []map[string]interface{} `json:"page_type_fields"`
	PageTypeEntries         []map[string]interface{} `json:"page_type_entries"`
	PageTypeSymbols         []map[string]interface{} `json:"page_type_symbols"`
	PageTypeSections        []map[string]interface{} `json:"page_type_sections"`
	PageTypeSectionEntries  []map[string]interface{} `json:"page_type_section_entries"`
	Pages                   []map[string]interface{} `json:"pages"`
	PageEntries             []map[string]interface{} `json:"page_entries"`
	PageSections            []map[string]interface{} `json:"page_sections"`
	PageSectionEntries      []map[string]interface{} `json:"page_section_entries"`
}

type FileEntry struct {
	Name string `json:"name"`
	Size int    `json:"size"`
}

type Snapshot struct {
	Metadata SnapshotMetadata `json:"metadata"`
	Records  SnapshotRecords  `json:"records"`
	Files    [][]byte         `json:"files"`
}

func decodeSnapshot(data []byte) (*Snapshot, error) {
	head := 0

	// Check signature
	if len(data) < len(snapshotSignature) {
		return nil, fmt.Errorf("invalid snapshot: too short")
	}
	if !bytes.Equal(data[0:len(snapshotSignature)], snapshotSignature) {
		return nil, fmt.Errorf("invalid snapshot signature")
	}
	head += len(snapshotSignature)

	// Read header (4 uint32s)
	headerSize := 4 * 4
	if len(data) < head+headerSize {
		return nil, fmt.Errorf("invalid snapshot: header too short")
	}
	header := make([]uint32, 4)
	buf := bytes.NewReader(data[head : head+headerSize])
	for i := range header {
		if err := binary.Read(buf, binary.LittleEndian, &header[i]); err != nil {
			return nil, err
		}
	}
	head += headerSize

	metadataSize := int(header[0])
	recordsSize := int(header[1])
	filemetaSize := int(header[2])

	// Read metadata
	if len(data) < head+metadataSize {
		return nil, fmt.Errorf("invalid snapshot: metadata section too short")
	}
	var metadata SnapshotMetadata
	if err := json.Unmarshal(data[head:head+metadataSize], &metadata); err != nil {
		return nil, fmt.Errorf("failed to decode metadata: %w", err)
	}
	head += metadataSize

	// Read records
	if len(data) < head+recordsSize {
		return nil, fmt.Errorf("invalid snapshot: records section too short")
	}
	var records SnapshotRecords
	if err := json.Unmarshal(data[head:head+recordsSize], &records); err != nil {
		return nil, fmt.Errorf("failed to decode records: %w", err)
	}
	head += recordsSize

	// Read file metadata
	if len(data) < head+filemetaSize {
		return nil, fmt.Errorf("invalid snapshot: filemeta section too short")
	}
	var filemeta []FileEntry
	if err := json.Unmarshal(data[head:head+filemetaSize], &filemeta); err != nil {
		return nil, fmt.Errorf("failed to decode filemeta: %w", err)
	}
	head += filemetaSize

	// Read file data
	files := make([][]byte, len(filemeta))
	for i, entry := range filemeta {
		if len(data) < head+entry.Size {
			return nil, fmt.Errorf("invalid snapshot: file data too short")
		}
		files[i] = data[head : head+entry.Size]
		head += entry.Size
	}

	// Replace file indices in site_uploads with actual file data
	for i := range records.SiteUploads {
		if fileIdx, ok := records.SiteUploads[i]["file"].(float64); ok {
			idx := int(fileIdx)
			if idx >= 0 && idx < len(files) {
				records.SiteUploads[i]["file"] = files[idx]
				records.SiteUploads[i]["file_name"] = filemeta[idx].Name
			}
		}
	}

	return &Snapshot{
		Metadata: metadata,
		Records:  records,
		Files:    files,
	}, nil
}

func cloneFromSnapshot(app core.App, snapshot *Snapshot, siteName, siteHost, siteGroupId string) (*core.Record, []string, error) {
	logs := []string{}
	// ID mappings for references
	idMap := make(map[string]map[string]string)
	idMap["sites"] = make(map[string]string)
	idMap["site_uploads"] = make(map[string]string)
	idMap["site_fields"] = make(map[string]string)
	idMap["site_entries"] = make(map[string]string)
	idMap["site_symbols"] = make(map[string]string)
	idMap["site_symbol_fields"] = make(map[string]string)
	idMap["site_symbol_entries"] = make(map[string]string)
	idMap["page_types"] = make(map[string]string)
	idMap["page_type_fields"] = make(map[string]string)
	idMap["page_type_entries"] = make(map[string]string)
	idMap["page_type_symbols"] = make(map[string]string)
	idMap["page_type_sections"] = make(map[string]string)
	idMap["page_type_section_entries"] = make(map[string]string)
	idMap["pages"] = make(map[string]string)
	idMap["page_entries"] = make(map[string]string)
	idMap["page_sections"] = make(map[string]string)
	idMap["page_section_entries"] = make(map[string]string)

	var createdSite *core.Record

	// Create site
	if len(snapshot.Records.Sites) > 0 {
		siteData := snapshot.Records.Sites[0]
		oldId, ok := getStringField(siteData, "id")
		if !ok || oldId == "" {
			return nil, logs, fmt.Errorf("site record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("sites")
		if err != nil {
			return nil, logs, err
		}

		record := core.NewRecord(collection)
		for k, v := range siteData {
			if k != "id" && k != "preview" {
				record.Set(k, v)
			}
		}
		record.Set("name", siteName)
		record.Set("host", siteHost)
		record.Set("group", siteGroupId)

		if err := app.Save(record); err != nil {
			return nil, logs, err
		}

		idMap["sites"][oldId] = record.Id
		createdSite = record
		logs = append(logs, fmt.Sprintf("Created site: %s", record.Id))
	}

	// Skip site uploads for now since files aren't included in marketplace snapshots
	// Just map the IDs so references don't break
	uploadCount := 0
	for _, uploadData := range snapshot.Records.SiteUploads {
		oldId, ok := getStringField(uploadData, "id")
		if !ok || oldId == "" {
			continue
		}
		// Map to empty string - upload references will be broken but won't crash
		idMap["site_uploads"][oldId] = ""
		uploadCount++
	}
	logs = append(logs, fmt.Sprintf("Skipped %d site uploads", uploadCount))

	// Create site fields (recursive)
	if err := createSiteFields(app, snapshot.Records.SiteFields, idMap, ""); err != nil {
		return nil, logs, err
	}

	logs = append(logs, fmt.Sprintf("Created %d site fields", len(idMap["site_fields"])))

	// Create site entries (recursive)
	if err := createSiteEntries(app, snapshot.Records.SiteEntries, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d site entries", len(idMap["site_entries"])))

	// Create site symbols
	for _, symbolData := range snapshot.Records.SiteSymbols {
		if err := createRecord(app, "site_symbols", symbolData, idMap, map[string]string{"site": "sites"}); err != nil {
			return nil, logs, err
		}
	}
	logs = append(logs, fmt.Sprintf("Created %d site symbols", len(idMap["site_symbols"])))

	// Create site symbol fields (recursive)
	if err := createSiteSymbolFields(app, snapshot.Records.SiteSymbolFields, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d site symbol fields", len(idMap["site_symbol_fields"])))

	// Create site symbol entries (recursive)
	if err := createSiteSymbolEntries(app, snapshot.Records.SiteSymbolEntries, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d site symbol entries", len(idMap["site_symbol_entries"])))

	// Create page types
	for _, pageTypeData := range snapshot.Records.PageTypes {
		if err := createRecord(app, "page_types", pageTypeData, idMap, map[string]string{"site": "sites"}); err != nil {
			return nil, logs, err
		}
	}
	logs = append(logs, fmt.Sprintf("Created %d page types", len(idMap["page_types"])))

	// Create page type fields (recursive)
	if err := createPageTypeFields(app, snapshot.Records.PageTypeFields, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d page type fields", len(idMap["page_type_fields"])))

	// Create page type entries (recursive)
	if err := createPageTypeEntries(app, snapshot.Records.PageTypeEntries, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d page type entries", len(idMap["page_type_entries"])))

	// Create page type symbols
	for _, symbolData := range snapshot.Records.PageTypeSymbols {
		if err := createRecord(app, "page_type_symbols", symbolData, idMap, map[string]string{
			"page_type": "page_types",
			"symbol":    "site_symbols",
		}); err != nil {
			return nil, logs, err
		}
	}
	logs = append(logs, fmt.Sprintf("Created %d page type symbols", len(idMap["page_type_symbols"])))

	// Create page type sections
	for _, sectionData := range snapshot.Records.PageTypeSections {
		if err := createRecord(app, "page_type_sections", sectionData, idMap, map[string]string{
			"page_type": "page_types",
			"symbol":    "site_symbols",
		}); err != nil {
			return nil, logs, err
		}
	}
	logs = append(logs, fmt.Sprintf("Created %d page type sections", len(idMap["page_type_sections"])))

	// Create page type section entries (recursive)
	if err := createPageTypeSectionEntries(app, snapshot.Records.PageTypeSectionEntries, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d page type section entries", len(idMap["page_type_section_entries"])))

	// Create pages (recursive)
	if err := createPages(app, snapshot.Records.Pages, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d pages", len(idMap["pages"])))

	// Create page entries (recursive)
	if err := createPageEntries(app, snapshot.Records.PageEntries, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d page entries", len(idMap["page_entries"])))

	// Create page sections
	for _, sectionData := range snapshot.Records.PageSections {
		if err := createRecord(app, "page_sections", sectionData, idMap, map[string]string{
			"page":   "pages",
			"symbol": "site_symbols",
		}); err != nil {
			return nil, logs, err
		}
	}
	logs = append(logs, fmt.Sprintf("Created %d page sections", len(idMap["page_sections"])))

	// Create page section entries (recursive)
	if err := createPageSectionEntries(app, snapshot.Records.PageSectionEntries, idMap, ""); err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Created %d page section entries", len(idMap["page_section_entries"])))

	// Update field config references
	logs = append(logs, "Updating field config references...")
	count, err := updateFieldConfigReferences(app, "site_fields", idMap, &logs)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d site_fields configs", count))

	count, err = updateFieldConfigReferences(app, "site_symbol_fields", idMap, &logs)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d site_symbol_fields configs", count))

	count, err = updateFieldConfigReferences(app, "page_type_fields", idMap, &logs)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d page_type_fields configs", count))

	// Update entry value references
	logs = append(logs, "Updating entry value references...")
	count, err = updateEntryValueReferences(app, "site_entries", idMap)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d site_entries values", count))

	count, err = updateEntryValueReferences(app, "site_symbol_entries", idMap)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d site_symbol_entries values", count))

	count, err = updateEntryValueReferences(app, "page_type_entries", idMap)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d page_type_entries values", count))

	count, err = updateEntryValueReferences(app, "page_type_section_entries", idMap)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d page_type_section_entries values", count))

	count, err = updateEntryValueReferences(app, "page_entries", idMap)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d page_entries values", count))

	count, err = updateEntryValueReferences(app, "page_section_entries", idMap)
	if err != nil {
		return nil, logs, err
	}
	logs = append(logs, fmt.Sprintf("Updated %d page_section_entries values", count))

	return createdSite, logs, nil
}

func createRecord(app core.App, collectionName string, data map[string]interface{}, idMap map[string]map[string]string, refFields map[string]string) error {
	oldId, ok := getStringField(data, "id")
	if !ok || oldId == "" {
		return fmt.Errorf("record in %s missing or invalid 'id' field", collectionName)
	}

	collection, err := app.FindCollectionByNameOrId(collectionName)
	if err != nil {
		return err
	}

	record := core.NewRecord(collection)
	for k, v := range data {
		if k == "id" || k == "compiled_js" || k == "compiled_html" {
			continue
		}

		// Remap references
		if refCollection, isRef := refFields[k]; isRef {
			if vStr, ok := v.(string); ok && vStr != "" {
				if newId, exists := idMap[refCollection][vStr]; exists {
					record.Set(k, newId)
					continue
				}
			}
		}

		record.Set(k, v)
	}

	if err := app.Save(record); err != nil {
		return err
	}

	idMap[collectionName][oldId] = record.Id
	return nil
}

func createSiteFields(app core.App, fields []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, fieldData := range fields {
		parentField, hasParent := getStringField(fieldData, "parent")
		if parentId == "" && hasParent && parentField != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentField != parentId) {
			continue
		}

		oldId, ok := getStringField(fieldData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("site_field record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("site_fields")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range fieldData {
			if k == "id" {
				continue
			}
			if k == "site" {
				if siteId, ok := v.(string); ok && siteId != "" {
					record.Set(k, idMap["sites"][siteId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["site_fields"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["site_fields"][oldId] = record.Id

		// Recursively create child fields
		if err := createSiteFields(app, fields, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createSiteEntries(app core.App, entries []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, entryData := range entries {
		parentEntry, hasParent := getStringField(entryData, "parent")
		if parentId == "" && hasParent && parentEntry != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentEntry != parentId) {
			continue
		}

		oldId, ok := getStringField(entryData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("site_entry record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("site_entries")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range entryData {
			if k == "id" {
				continue
			}
			if k == "field" {
				if fieldId, ok := v.(string); ok && fieldId != "" {
					record.Set(k, idMap["site_fields"][fieldId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["site_entries"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["site_entries"][oldId] = record.Id

		// Recursively create child entries
		if err := createSiteEntries(app, entries, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createSiteSymbolFields(app core.App, fields []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, fieldData := range fields {
		parentField, hasParent := getStringField(fieldData, "parent")
		if parentId == "" && hasParent && parentField != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentField != parentId) {
			continue
		}

		oldId, ok := getStringField(fieldData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("site_symbol_field record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("site_symbol_fields")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range fieldData {
			if k == "id" {
				continue
			}
			if k == "symbol" {
				if symbolId, ok := v.(string); ok && symbolId != "" {
					record.Set(k, idMap["site_symbols"][symbolId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["site_symbol_fields"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["site_symbol_fields"][oldId] = record.Id

		// Recursively create child fields
		if err := createSiteSymbolFields(app, fields, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createSiteSymbolEntries(app core.App, entries []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, entryData := range entries {
		parentEntry, hasParent := getStringField(entryData, "parent")
		if parentId == "" && hasParent && parentEntry != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentEntry != parentId) {
			continue
		}

		oldId, ok := getStringField(entryData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("site_symbol_entry record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("site_symbol_entries")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range entryData {
			if k == "id" {
				continue
			}
			if k == "field" {
				if fieldId, ok := v.(string); ok && fieldId != "" {
					record.Set(k, idMap["site_symbol_fields"][fieldId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["site_symbol_entries"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["site_symbol_entries"][oldId] = record.Id

		// Recursively create child entries
		if err := createSiteSymbolEntries(app, entries, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createPageTypeFields(app core.App, fields []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, fieldData := range fields {
		parentField, hasParent := getStringField(fieldData, "parent")
		if parentId == "" && hasParent && parentField != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentField != parentId) {
			continue
		}

		oldId, ok := getStringField(fieldData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("page_type_field record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("page_type_fields")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range fieldData {
			if k == "id" {
				continue
			}
			if k == "page_type" {
				if pageTypeId, ok := v.(string); ok && pageTypeId != "" {
					record.Set(k, idMap["page_types"][pageTypeId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["page_type_fields"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["page_type_fields"][oldId] = record.Id

		// Recursively create child fields
		if err := createPageTypeFields(app, fields, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createPageTypeEntries(app core.App, entries []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, entryData := range entries {
		parentEntry, hasParent := getStringField(entryData, "parent")
		if parentId == "" && hasParent && parentEntry != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentEntry != parentId) {
			continue
		}

		oldId, ok := getStringField(entryData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("page_type_entry record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("page_type_entries")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range entryData {
			if k == "id" {
				continue
			}
			if k == "field" {
				if fieldId, ok := v.(string); ok && fieldId != "" {
					record.Set(k, idMap["page_type_fields"][fieldId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["page_type_entries"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["page_type_entries"][oldId] = record.Id

		// Recursively create child entries
		if err := createPageTypeEntries(app, entries, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createPageTypeSectionEntries(app core.App, entries []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, entryData := range entries {
		parentEntry, hasParent := getStringField(entryData, "parent")
		if parentId == "" && hasParent && parentEntry != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentEntry != parentId) {
			continue
		}

		oldId, ok := getStringField(entryData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("page_type_section_entry record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("page_type_section_entries")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range entryData {
			if k == "id" {
				continue
			}
			if k == "section" {
				if sectionId, ok := v.(string); ok && sectionId != "" {
					record.Set(k, idMap["page_type_sections"][sectionId])
				}
			} else if k == "field" {
				if fieldId, ok := v.(string); ok && fieldId != "" {
					record.Set(k, idMap["site_symbol_fields"][fieldId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["page_type_section_entries"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["page_type_section_entries"][oldId] = record.Id

		// Recursively create child entries
		if err := createPageTypeSectionEntries(app, entries, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createPages(app core.App, pages []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, pageData := range pages {
		parentPage, hasParent := getStringField(pageData, "parent")
		if parentId == "" && hasParent && parentPage != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentPage != parentId) {
			continue
		}

		oldId, ok := getStringField(pageData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("page record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("pages")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range pageData {
			if k == "id" || k == "compiled_html" {
				continue
			}
			if k == "site" {
				if siteId, ok := v.(string); ok && siteId != "" {
					record.Set(k, idMap["sites"][siteId])
				}
			} else if k == "page_type" {
				if pageTypeId, ok := v.(string); ok && pageTypeId != "" {
					record.Set(k, idMap["page_types"][pageTypeId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["pages"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["pages"][oldId] = record.Id

		// Recursively create child pages
		if err := createPages(app, pages, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createPageEntries(app core.App, entries []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, entryData := range entries {
		parentEntry, hasParent := getStringField(entryData, "parent")
		if parentId == "" && hasParent && parentEntry != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentEntry != parentId) {
			continue
		}

		oldId, ok := getStringField(entryData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("page_entry record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("page_entries")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range entryData {
			if k == "id" {
				continue
			}
			if k == "page" {
				if pageId, ok := v.(string); ok && pageId != "" {
					record.Set(k, idMap["pages"][pageId])
				}
			} else if k == "field" {
				if fieldId, ok := v.(string); ok && fieldId != "" {
					record.Set(k, idMap["page_type_fields"][fieldId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["page_entries"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["page_entries"][oldId] = record.Id

		// Recursively create child entries
		if err := createPageEntries(app, entries, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func createPageSectionEntries(app core.App, entries []map[string]interface{}, idMap map[string]map[string]string, parentId string) error {
	for _, entryData := range entries {
		parentEntry, hasParent := getStringField(entryData, "parent")
		if parentId == "" && hasParent && parentEntry != "" {
			continue
		}
		if parentId != "" && (!hasParent || parentEntry != parentId) {
			continue
		}

		oldId, ok := getStringField(entryData, "id")
		if !ok || oldId == "" {
			return fmt.Errorf("page_section_entry record missing or invalid 'id' field")
		}

		collection, err := app.FindCollectionByNameOrId("page_section_entries")
		if err != nil {
			return err
		}

		record := core.NewRecord(collection)
		for k, v := range entryData {
			if k == "id" {
				continue
			}
			if k == "section" {
				if sectionId, ok := v.(string); ok && sectionId != "" {
					record.Set(k, idMap["page_sections"][sectionId])
				}
			} else if k == "field" {
				if fieldId, ok := v.(string); ok && fieldId != "" {
					record.Set(k, idMap["site_symbol_fields"][fieldId])
				}
			} else if k == "parent" {
				if parentStr, ok := v.(string); ok && parentStr != "" {
					record.Set(k, idMap["page_section_entries"][parentStr])
				}
			} else {
				record.Set(k, v)
			}
		}

		if err := app.Save(record); err != nil {
			return err
		}

		idMap["page_section_entries"][oldId] = record.Id

		// Recursively create child entries
		if err := createPageSectionEntries(app, entries, idMap, oldId); err != nil {
			return err
		}
	}
	return nil
}

func updateFieldConfigReferences(app core.App, collectionName string, idMap map[string]map[string]string, logs *[]string) (int, error) {
	collection, err := app.FindCollectionByNameOrId(collectionName)
	if err != nil {
		return 0, err
	}

	updatedCount := 0
	checkedCount := 0
	fieldTypeCounts := make(map[string]int)
	totalFields := len(idMap[collectionName])
	*logs = append(*logs, fmt.Sprintf("  Processing %d fields from idMap[%s]", totalFields, collectionName))

	// Get all fields from this collection that we created
	for oldId, newId := range idMap[collectionName] {
		if newId == "" {
			*logs = append(*logs, fmt.Sprintf("  Skipping empty newId for oldId=%s", oldId))
			continue
		}

		record, err := app.FindRecordById(collection.Id, newId)
		if err != nil {
			*logs = append(*logs, fmt.Sprintf("  Failed to find record newId=%s: %v", newId, err))
			continue
		}

		checkedCount++
		fieldType := record.GetString("type")
		fieldTypeCounts[fieldType]++
		config := record.Get("config")

		// Config is stored as JSONRaw, need to unmarshal it
		var configMap map[string]interface{}
		if configRaw, ok := config.(types.JSONRaw); ok {
			if len(configRaw) > 0 {
				if err := json.Unmarshal(configRaw, &configMap); err != nil {
					if checkedCount <= 3 {
						*logs = append(*logs, fmt.Sprintf("  Field %s type=%s: failed to unmarshal config: %v", newId, fieldType, err))
					}
					continue
				}
			}
		} else if configBytes, ok := config.([]byte); ok {
			if len(configBytes) > 0 {
				if err := json.Unmarshal(configBytes, &configMap); err != nil {
					if checkedCount <= 3 {
						*logs = append(*logs, fmt.Sprintf("  Field %s type=%s: failed to unmarshal config: %v", newId, fieldType, err))
					}
					continue
				}
			}
		} else if configMapDirect, ok := config.(map[string]interface{}); ok {
			configMap = configMapDirect
		} else {
			if checkedCount <= 3 {
				*logs = append(*logs, fmt.Sprintf("  Field %s type=%s: config is not JSONRaw or map, it's %T", newId, fieldType, config))
			}
			continue
		}

		updated := false
		newConfig := make(map[string]interface{})
		for k, v := range configMap {
			newConfig[k] = v
		}

		// Update field type specific references
		if fieldType == "page" || fieldType == "page-list" {
			if checkedCount <= 3 {
				*logs = append(*logs, fmt.Sprintf("    %s field config: %v", fieldType, newConfig))
			}
			if pageTypeId, ok := newConfig["page_type"].(string); ok && pageTypeId != "" {
				newPageTypeId, exists := idMap["page_types"][pageTypeId]
				if checkedCount <= 3 {
					*logs = append(*logs, fmt.Sprintf("    %s field: pageTypeId=%s, exists=%v, newId=%s", fieldType, pageTypeId, exists, newPageTypeId))
				}
				if exists && newPageTypeId != "" {
					newConfig["page_type"] = newPageTypeId
					updated = true
				}
			}
		} else if fieldType == "page-field" {
			if checkedCount <= 3 {
				*logs = append(*logs, fmt.Sprintf("    page-field config: %v", newConfig))
			}
			if fieldId, ok := newConfig["field"].(string); ok && fieldId != "" {
				newFieldId, exists := idMap["page_type_fields"][fieldId]
				if checkedCount <= 3 {
					*logs = append(*logs, fmt.Sprintf("    page-field: fieldId=%s, exists=%v, newId=%s", fieldId, exists, newFieldId))
				}
				if exists && newFieldId != "" {
					newConfig["field"] = newFieldId
					updated = true
				}
			}
		} else if fieldType == "site-field" {
			if checkedCount <= 3 {
				*logs = append(*logs, fmt.Sprintf("    site-field config: %v", newConfig))
			}
			if fieldId, ok := newConfig["field"].(string); ok && fieldId != "" {
				newFieldId, exists := idMap["site_fields"][fieldId]
				if checkedCount <= 3 {
					*logs = append(*logs, fmt.Sprintf("    site-field: fieldId=%s, exists=%v, newId=%s", fieldId, exists, newFieldId))
				}
				if exists && newFieldId != "" {
					newConfig["field"] = newFieldId
					updated = true
				}
			}
		}

		// Update condition field references
		if condition, ok := newConfig["condition"].(map[string]interface{}); ok {
			if condFieldId, ok := condition["field"].(string); ok && condFieldId != "" {
				// Try to find in the same collection's field map
				if newFieldId, exists := idMap[collectionName][condFieldId]; exists && newFieldId != "" {
					newCondition := make(map[string]interface{})
					for k, v := range condition {
						newCondition[k] = v
					}
					newCondition["field"] = newFieldId
					newConfig["condition"] = newCondition
					updated = true
				}
			}
		}

		if updated {
			// Marshal config back to JSON
			configJSON, err := json.Marshal(newConfig)
			if err != nil {
				return 0, err
			}
			record.Set("config", configJSON)
			if err := app.Save(record); err != nil {
				return 0, err
			}
			updatedCount++
		}
	}

	*logs = append(*logs, fmt.Sprintf("  Checked %d fields in %s, types: %v", checkedCount, collectionName, fieldTypeCounts))
	return updatedCount, nil
}

func updateEntryValueReferences(app core.App, collectionName string, idMap map[string]map[string]string) (int, error) {
	collection, err := app.FindCollectionByNameOrId(collectionName)
	if err != nil {
		return 0, err
	}

	updatedCount := 0
	// Map collection name to field collection name
	fieldCollectionName := ""
	switch collectionName {
	case "site_entries":
		fieldCollectionName = "site_fields"
	case "site_symbol_entries":
		fieldCollectionName = "site_symbol_fields"
	case "page_type_entries":
		fieldCollectionName = "page_type_fields"
	case "page_type_section_entries":
		fieldCollectionName = "site_symbol_fields"
	case "page_entries":
		fieldCollectionName = "page_type_fields"
	case "page_section_entries":
		fieldCollectionName = "site_symbol_fields"
	default:
		return 0, nil
	}

	// Get all entries from this collection that we created
	for _, newId := range idMap[collectionName] {
		if newId == "" {
			continue
		}

		record, err := app.FindRecordById(collection.Id, newId)
		if err != nil {
			continue
		}

		fieldId := record.GetString("field")
		if fieldId == "" {
			continue
		}

		// Find the field record to get its type
		fieldCollection, err := app.FindCollectionByNameOrId(fieldCollectionName)
		if err != nil {
			continue
		}

		fieldRecord, err := app.FindRecordById(fieldCollection.Id, fieldId)
		if err != nil {
			continue
		}

		fieldType := fieldRecord.GetString("type")
		value := record.Get("value")

		// Value is stored as JSONRaw, need to unmarshal it
		var valueData interface{}
		if valueRaw, ok := value.(types.JSONRaw); ok {
			if len(valueRaw) > 0 {
				if err := json.Unmarshal(valueRaw, &valueData); err != nil {
					continue
				}
			}
		} else if valueBytes, ok := value.([]byte); ok {
			if len(valueBytes) > 0 {
				if err := json.Unmarshal(valueBytes, &valueData); err != nil {
					continue
				}
			}
		} else {
			valueData = value
		}

		updated := false
		newValue := valueData

		// Update based on field type
		if fieldType == "image" {
			if valueMap, ok := valueData.(map[string]interface{}); ok {
				if uploadId, ok := valueMap["upload"].(string); ok && uploadId != "" {
					if newUploadId, exists := idMap["site_uploads"][uploadId]; exists {
						newValueMap := make(map[string]interface{})
						for k, v := range valueMap {
							newValueMap[k] = v
						}
						newValueMap["upload"] = newUploadId
						newValue = newValueMap
						updated = true
					}
				}
			}
		} else if fieldType == "link" {
			if valueMap, ok := valueData.(map[string]interface{}); ok {
				if pageId, ok := valueMap["page"].(string); ok && pageId != "" {
					if newPageId, exists := idMap["pages"][pageId]; exists && newPageId != "" {
						newValueMap := make(map[string]interface{})
						for k, v := range valueMap {
							newValueMap[k] = v
						}
						newValueMap["page"] = newPageId
						newValue = newValueMap
						updated = true
					}
				}
			}
		} else if fieldType == "page" {
			if pageId, ok := valueData.(string); ok && pageId != "" {
				if newPageId, exists := idMap["pages"][pageId]; exists && newPageId != "" {
					newValue = newPageId
					updated = true
				}
			}
		}

		if updated {
			// Marshal value back to JSON
			valueJSON, err := json.Marshal(newValue)
			if err != nil {
				return 0, err
			}
			record.Set("value", valueJSON)
			if err := app.Save(record); err != nil {
				return 0, err
			}
			updatedCount++
		}
	}

	return updatedCount, nil
}

func RegisterCloneMarketplaceStarter(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/palacms/clone-marketplace-starter", func(requestEvent *core.RequestEvent) error {
			startTime := time.Now()

			body := struct {
				SnapshotID  string `json:"snapshot_id"`
				Filename    string `json:"filename"`
				SiteName    string `json:"site_name"`
				SiteHost    string `json:"site_host"`
				SiteGroupId string `json:"site_group_id"`
			}{}
			if err := requestEvent.BindBody(&body); err != nil {
				return err
			}

			if body.SnapshotID == "" {
				return requestEvent.BadRequestError("snapshot_id missing", nil)
			}
			if body.Filename == "" {
				return requestEvent.BadRequestError("filename missing", nil)
			}
			if body.SiteName == "" {
				return requestEvent.BadRequestError("site_name missing", nil)
			}
			if body.SiteHost == "" {
				return requestEvent.BadRequestError("site_host missing", nil)
			}
			if body.SiteGroupId == "" {
				return requestEvent.BadRequestError("site_group_id missing", nil)
			}

			// Check permissions (user must be authenticated)
			info, err := requestEvent.RequestInfo()
			if err != nil {
				return err
			}
			if info.Auth == nil {
				return requestEvent.UnauthorizedError("", nil)
			}

			// Construct snapshot URL server-side to prevent SSRF
			snapshotURL := fmt.Sprintf("https://marketplace.palacms.com/api/files/site_snapshots/%s/%s",
				body.SnapshotID, body.Filename)

			downloadStart := time.Now()
			// Download snapshot file from marketplace with timeout and size limit
			client := &http.Client{
				Timeout: 30 * time.Second,
			}
			resp, err := client.Get(snapshotURL)
			if err != nil {
				return requestEvent.InternalServerError("Failed to fetch snapshot", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				return requestEvent.InternalServerError("Failed to fetch snapshot", fmt.Errorf("status %d", resp.StatusCode))
			}

			// Limit response body to 10MB to prevent memory exhaustion
			maxSize := int64(10 * 1024 * 1024)
			limitedReader := io.LimitReader(resp.Body, maxSize)
			snapshotData, err := io.ReadAll(limitedReader)
			if err != nil {
				return requestEvent.InternalServerError("Failed to read snapshot", err)
			}
			downloadDuration := time.Since(downloadStart)

			decodeStart := time.Now()
			// Decode snapshot
			snapshot, err := decodeSnapshot(snapshotData)
			if err != nil {
				return requestEvent.InternalServerError("Failed to decode snapshot", err)
			}
			decodeDuration := time.Since(decodeStart)

			cloneStart := time.Now()
			// Clone from snapshot wrapped in transaction for atomicity and performance
			var createdSite *core.Record
			var logs []string
			err = pb.RunInTransaction(func(txApp core.App) error {
				var txErr error
				createdSite, logs, txErr = cloneFromSnapshot(txApp, snapshot, body.SiteName, body.SiteHost, body.SiteGroupId)
				if txErr != nil {
					return txErr
				}
				if createdSite == nil {
					return fmt.Errorf("snapshot contains no site data")
				}
				return nil
			})
			if err != nil {
				pb.Logger().Error("Failed to clone site from marketplace",
					"error", err,
					"site_name", body.SiteName,
					"snapshot_id", body.SnapshotID,
				)
				return requestEvent.InternalServerError("Failed to clone site", err)
			}
			cloneDuration := time.Since(cloneStart)

			totalDuration := time.Since(startTime)

			pb.Logger().Info("Cloned marketplace starter",
				"site_id", createdSite.Id,
				"total_ms", totalDuration.Milliseconds(),
				"download_ms", downloadDuration.Milliseconds(),
				"decode_ms", decodeDuration.Milliseconds(),
				"clone_ms", cloneDuration.Milliseconds(),
			)

			return requestEvent.JSON(200, map[string]interface{}{
				"site_id":      createdSite.Id,
				"duration_ms":  totalDuration.Milliseconds(),
				"download_ms":  downloadDuration.Milliseconds(),
				"decode_ms":    decodeDuration.Milliseconds(),
				"clone_ms":     cloneDuration.Milliseconds(),
				"logs":         logs,
			})
		})

		return serveEvent.Next()
	})

	return nil
}
