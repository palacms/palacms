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
			// Special headers are applied ONLY when the explicit "?_site" param is present on this request.
			paramSiteId := requestEvent.Request.URL.Query().Get("_site")
			siteId := paramSiteId
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

			// If explicitly requested via ?_site, relax frame embedding for preview iframes.
			if paramSiteId != "" {
				// Prefer modern CSP over X-Frame-Options.
				// Allow any ancestor for iframe previews. This route is only used for explicit preview access.
				requestEvent.Response.Header().Set("Content-Security-Policy", "frame-ancestors *")
				// Ensure no restrictive X-Frame-Options leaks from proxies/middleware.
				requestEvent.Response.Header().Del("X-Frame-Options")
			}

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
