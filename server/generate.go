package server

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

func generateSymbols(pb *pocketbase.PocketBase, system *filesystem.System, site *core.Record) ([]string, error) {
	collection, err := pb.FindCollectionByNameOrId("site_symbols")
	if err != nil {
		return nil, err
	}

	symbols, err := pb.FindRecordsByFilter(
		collection.Id,
		"site = {:site}",
		"",
		0,
		0,
		dbx.Params{"site": site.Id},
	)
	if err != nil {
		return nil, err
	}

	newFiles := make([]string, 0, len(symbols))
	for _, symbol := range symbols {
		name := symbol.GetString("compiled_js")
		if name == "" {
			continue
		}

		sourceKey := collection.Id + "/" + symbol.Id + "/" + name
		destinationKey := "sites/" + site.GetString("host") + "/_symbols/" + symbol.Id + ".js"
		if err := system.Copy(sourceKey, destinationKey); err != nil {
			return nil, err
		}

		newFiles = append(newFiles, destinationKey)
	}

	return newFiles, nil
}

func generateUploads(pb *pocketbase.PocketBase, system *filesystem.System, site *core.Record) ([]string, error) {
	collection, err := pb.FindCollectionByNameOrId("site_uploads")
	if err != nil {
		return nil, err
	}

	uploads, err := pb.FindRecordsByFilter(
		collection.Id,
		"site = {:site}",
		"",
		0,
		0,
		dbx.Params{"site": site.Id},
	)
	if err != nil {
		return nil, err
	}

	newFiles := make([]string, 0, len(uploads))
	for _, upload := range uploads {
		name := upload.GetString("file")
		sourceKey := collection.Id + "/" + upload.Id + "/" + name
		destinationKey := "sites/" + site.GetString("host") + "/_uploads/" + name
		if err := system.Copy(sourceKey, destinationKey); err != nil {
			return nil, err
		}

		newFiles = append(newFiles, destinationKey)
	}

	return newFiles, nil
}

func generatePages(pb *pocketbase.PocketBase, system *filesystem.System, site *core.Record) ([]string, error) {
	collection, err := pb.FindCollectionByNameOrId("pages")
	if err != nil {
		return nil, err
	}

	pages, err := pb.FindRecordsByFilter(
		collection.Id,
		"site = {:site}",
		"",
		0,
		0,
		dbx.Params{"site": site.Id},
	)
	if err != nil {
		return nil, err
	}

	newFiles := make([]string, 0, len(pages))
	for _, page := range pages {
		if page.GetString("parent") == "" {
			newPageFiles, err := generatePage(
				system,
				collection,
				site,
				pages,
				page,
				"",
			)
			if err != nil {
				return nil, err
			}

			newFiles = append(newFiles, newPageFiles...)
		}
	}

	return newFiles, nil
}

func generatePage(
	system *filesystem.System,
	collection *core.Collection,
	site *core.Record,
	pages []*core.Record,
	page *core.Record,
	path string,
) ([]string, error) {
	name := page.GetString("compiled_html")
	sourceKey := collection.Id + "/" + page.Id + "/" + name
	destinationKey := "sites/" + site.GetString("host") + path + "/index.html"
	if err := system.Copy(sourceKey, destinationKey); err != nil {
		return nil, err
	}

	newFiles := []string{destinationKey}
	for _, subPage := range pages {
		if subPage.GetString("parent") == page.Id {
			newSubPageFiles, err := generatePage(
				system,
				collection,
				site,
				pages,
				subPage,
				path+"/"+subPage.GetString("slug"),
			)
			if err != nil {
				return nil, err
			}

			newFiles = append(newFiles, newSubPageFiles...)
		}
	}

	return newFiles, nil
}

func RegisterGenerateEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.POST("/api/palacms/generate", func(requestEvent *core.RequestEvent) error {
			body := struct {
				SiteId string `json:"site_id"`
			}{}
			requestEvent.BindBody(&body)

			if body.SiteId == "" {
				return requestEvent.BadRequestError("site_id missing", nil)
			}

			site, err := pb.FindRecordById("sites", body.SiteId)
			if err != nil {
				return err
			}

			info, err := requestEvent.RequestInfo()
			if err != nil {
				return err
			}

			canAccess, err := requestEvent.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
			if !canAccess {
				return requestEvent.ForbiddenError("", err)
			}

			system, err := pb.NewFilesystem()
			if err != nil {
				return err
			}

			existingFiles, err := system.List("sites/" + site.GetString("host") + "/")
			if err != nil {
				return err
			}

			symbolFiles, err := generateSymbols(pb, system, site)
			if err != nil {
				return err
			}

			uploadFiles, err := generateUploads(pb, system, site)
			if err != nil {
				return err
			}

			pageFiles, err := generatePages(pb, system, site)
			if err != nil {
				return err
			}

		cleanup:
			for _, file := range existingFiles {
				if file.IsDir {
					continue
				}

				for _, symbolFile := range symbolFiles {
					if file.Key == symbolFile {
						continue cleanup
					}
				}

				for _, uploadFile := range uploadFiles {
					if file.Key == uploadFile {
						continue cleanup
					}
				}

				for _, pageFile := range pageFiles {
					if file.Key == pageFile {
						continue cleanup
					}
				}

				if err := system.Delete(file.Key); err != nil {
					return err
				}
			}

			return nil
		})
		return serveEvent.Next()
	})

	return nil
}
