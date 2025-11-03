package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	collections := []string{
		"library_symbols",
		"site_symbols",
		"page_types",
		"sites",
	}

	fields := []string{
		"js",
		"css",
		"html",
		"head",
		"foot",
	}

	m.Register(
		func(app core.App) error {
			for _, name := range collections {
				collection, err := app.FindCollectionByNameOrId(name)
				if err != nil {
					return err
				}

				for _, name := range fields {
					field, ok := collection.Fields.GetByName(name).(*core.TextField)
					if !ok {
						continue
					}

					field.Max = 100_000
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
