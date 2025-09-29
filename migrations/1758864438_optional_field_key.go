// Migration 1758864438 (2025-09-26): Make field `key` optional and drop unique index.
//
// Context:
// - Having `key` required prevented the app from committing field creations unless
//   `key` was filled out immediately.
// - This caused a bug where creating a field right after editing a field triggered
//   a commit on both operations and led to a crash.
//
// What this does:
// - Marks the `key` text field as not required.
// - Removes the unique index on the collection.

package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	fieldCollections := []string{
		"library_symbol_fields",
		"page_type_fields",
		"site_fields",
		"site_symbol_fields",
	}

	m.Register(
		func(app core.App) error {
			for _, name := range fieldCollections {
				collection, err := app.FindCollectionByNameOrId(name)
				if err != nil {
					return err
				}

				// Make key field optional
				field := collection.Fields.GetByName("key").(*core.TextField)
				field.Required = false

				// Remove the unique index
				collection.Indexes = types.JSONArray[string]{}

				if err := app.Save(collection); err != nil {
					return err
				}
			}

			return nil
		},
		func(app core.App) error {
			// This migration is irreversible.
			return nil
		},
	)
}
