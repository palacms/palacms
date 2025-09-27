package internal

import (
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func ServeSites(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		fs, err := pb.NewFilesystem()
		if err != nil {
			return err
		}

		serveEvent.Router.GET("/{path...}", func(requestEvent *core.RequestEvent) error {
			// Resolve site ID (explicit param) or from referrer URL for host mapping.
			siteId := requestEvent.Request.URL.Query().Get("_site")
			referer := requestEvent.Request.Header.Get("Referer")
			if siteId == "" && referer != "" {
				refererUrl, err := url.Parse(referer)
				if err != nil {
					return err
				}

				if refererUrl.Host == requestEvent.Request.Host {
					siteId = refererUrl.Query().Get("_site")
				}
			}

			reqHost := requestEvent.Request.Host
			if siteId != "" {
				site, err := pb.FindRecordById("sites", siteId)
				if err != nil {
					return err
				}

				// Override host based on the resolved site ID
				reqHost = site.GetString("host")
			}

			reqPath := requestEvent.Request.PathValue("path")
			fileKey := "sites/" + reqHost + "/" + reqPath
			fileName := path.Base(fileKey)

			isHome := false
			if reqPath == "" {
				// Rewrite home page
				isHome = true
				fileKey = fileKey + "index.html"
				fileName = "index.html"
			}

			exists, err := fs.Exists(fileKey)
			if err != nil {
				return err
			} else if !exists && isHome {
				// Home not found, redirect to site editor
				return requestEvent.Redirect(302, "/admin")
			} else if !exists && path.Ext(fileKey) == "" {
				// Fallback to index.html
				fileKey = strings.TrimSuffix(fileKey, "/") + "/index.html"
				fileName = "index.html"
			}

			reader, err := fs.GetReader(fileKey)
			if err != nil {
				return err
			}
			defer reader.Close()

			http.ServeContent(
				requestEvent.Response,
				requestEvent.Request,
				fileName,
				reader.ModTime(),
				reader,
			)
			return nil
		})

		return serveEvent.Next()
	})

	return nil
}
