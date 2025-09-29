// Migration 1759023967 (2025-09-29): Flatten markdown values and normalize html placeholders.
//
// Context:
// - Stop storing rendered html in the DB; render output at runtime (see v3 `src/lib/Content.svelte.ts`).
//   This aligns with best practices and avoids persisting derived data.
// - Refactor content fields: move away from `{ "markdown": string }` objects to plain strings,
//   and split the previous markdown field into `markdown` and `richtext` to resolve issues caused
//   by on-page editing mutating markdown. A future toggle may expose original markdown as needed.
//
// What this does:
// - For collections with a `value` field, if `value` is a JSON object containing `markdown`,
//   replace `value` with that string (flatten to plain text).
// - For `site_symbols` and `library_symbols`, update `html` by replacing
//   `{@html <name>.html}` with `{@html <name>}`.

package migrations

import (
	"encoding/json"
	"fmt"
	"regexp"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(
		func(app core.App) error {
			if err := flattenMarkdownValue(app); err != nil {
				return err
			}
			if err := removeHTMLSuffixInSymbolCode(app); err != nil {
				return err
			}
			return nil
		},
		func(app core.App) error {
			// This migration is irreversible.
			return nil
		},
	)
}

func flattenMarkdownValue(app core.App) error {
	collections := []string{
		"page_entries",
		"page_section_entries",
		"library_symbol_entries",
		"page_type_entries",
		"page_type_section_entries",
		"site_entries",
		"site_symbol_entries",
	}

	for _, collectionName := range collections {
		fmt.Printf("Looking in collection for markdown entry values to flatten: collection=%s updated value\n", collectionName)
		collection, err := app.FindCollectionByNameOrId(collectionName)
		if err != nil {
			return fmt.Errorf("failed to find collection %s: %w", collectionName, err)
		}

		records, err := app.FindAllRecords(collection.Id)
		if err != nil {
			return fmt.Errorf("failed to fetch records for collection %s: %w", collectionName, err)
		}

		type MarkdownValue struct {
			Markdown string `json:"markdown"`
			HTML     string `json:"html"`
		}

		for _, record := range records {
			var jsonObj MarkdownValue
			if err := record.UnmarshalJSONField("value", &jsonObj); err == nil {
				markdownJson, _ := json.Marshal(jsonObj.Markdown)
				fmt.Printf("Updating markdown value: collection=%s record=%s\n", collectionName, record.Id)

				record.Set("value", types.JSONRaw(markdownJson))
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func removeHTMLSuffixInSymbolCode(app core.App) error {
	collections := []string{
		"site_symbols",
		"library_symbols",
	}

	for _, collectionName := range collections {
		fmt.Printf("Looking in collection for HTML to edit: collection=%s updated value\n", collectionName)
		collection, err := app.FindCollectionByNameOrId(collectionName)
		if err != nil {
			return fmt.Errorf("failed to find collection %s: %w", collectionName, err)
		}

		records, err := app.FindAllRecords(collection.Id)
		if err != nil {
			return fmt.Errorf("failed to fetch records for collection %s: %w", collectionName, err)
		}

		for _, record := range records {
			html, ok := record.Get("html").(string)
			if !ok {
				continue
			}

			re := regexp.MustCompile(`\{@html\s+([A-Za-z0-9_]+)\.html\}`)
			newHtml := re.ReplaceAllString(html, `{@html $1}`)

			if html != newHtml {
				fmt.Printf("Removing .html suffix in symbol code: collection=%s record=%s\n", collectionName, record.Id)
				record.Set("html", newHtml)
				if err := app.Save(record); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
