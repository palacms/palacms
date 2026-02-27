package internal

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// buildSiteZip creates an in-memory ZIP archive of the generated site files
// stored under sites/<host>/… and returns the buffer.
func buildSiteZip(pb *pocketbase.PocketBase, host string) (*bytes.Buffer, error) {
	fs, err := pb.NewFilesystem()
	if err != nil {
		return nil, err
	}

	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	prefix := "sites/" + host + "/"

	var walk func(string) error
	walk = func(pfx string) error {
		entries, err := fs.List(pfx)
		if err != nil {
			return err
		}
		for _, ent := range entries {
			if ent.IsDir {
				if err := walk(strings.TrimSuffix(ent.Key, "/") + "/"); err != nil {
					return err
				}
				continue
			}
			r, err := fs.GetReader(ent.Key)
			if err != nil {
				return err
			}
			f, err := zw.Create(strings.TrimPrefix(ent.Key, prefix))
			if err != nil {
				r.Close()
				return err
			}
			if _, err := io.Copy(f, r); err != nil {
				r.Close()
				return err
			}
			r.Close()
		}
		return nil
	}

	if err := walk(prefix); err != nil {
		zw.Close()
		return nil, err
	}
	zw.Close()

	return buf, nil
}

// RegisterExportEndpoints registers endpoints used for downloading and
// deploying a generated site.  The handlers expect the caller to be
// authenticated and authorised to view the site in question (same checks as
// generate.go).
func RegisterExportEndpoints(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// download the generated files as a zip archive
		se.Router.GET("/api/palacms/site-zip/:siteId", func(e *core.RequestEvent) error {
			site, err := pb.FindRecordById("sites", e.Param("siteId"))
			if err != nil {
				return e.NotFoundError("site not found", err)
			}

			info, _ := e.RequestInfo()
			canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().ViewRule)
			if !canAccess {
				return e.ForbiddenError("", nil)
			}

			buf, err := buildSiteZip(pb, site.GetString("host"))
			if err != nil {
				return err
			}

			e.Response.Header().Set("Content-Type", "application/zip")
			e.Response.Header().Set("Content-Disposition",
				fmt.Sprintf(`attachment; filename="%s.zip"`, site.GetString("host")))
			e.Response.Write(buf.Bytes())
			return nil
		})

		// trigger a deployment to Cloudflare Pages
		se.Router.POST("/api/palacms/deploy/:siteId", func(e *core.RequestEvent) error {
			site, err := pb.FindRecordById("sites", e.Param("siteId"))
			if err != nil {
				return e.NotFoundError("site not found", err)
			}

			info, _ := e.RequestInfo()
			canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
			if !canAccess {
				return e.ForbiddenError("", nil)
			}

			buf, err := buildSiteZip(pb, site.GetString("host"))
			if err != nil {
				return err
			}

			// allow per-site overrides stored on the site record; fall back to
			// environment variables for a global default.
			acct := site.GetString("cfAccountId")
			if acct == "" {
				acct = os.Getenv("CF_ACCOUNT_ID")
			}
			proj := site.GetString("cfProjectName")
			if proj == "" {
				proj = os.Getenv("CF_PROJECT_NAME")
			}
			token := site.GetString("cfApiToken")
			if token == "" {
				token = os.Getenv("CF_API_TOKEN")
			}
			if acct == "" || proj == "" || token == "" {
				return e.InternalError("cloudflare credentials missing", nil)
			}

			req, err := http.NewRequest(
				"POST",
				"https://api.cloudflare.com/client/v4/accounts/"+acct+
					"/pages/projects/"+proj+"/deployments",
				buf,
			)
			if err != nil {
				return err
			}
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/zip")

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode >= 300 {
				body, _ := io.ReadAll(resp.Body)
				return e.InternalError("cloudflare error: "+string(body), nil)
			}

			var result struct {
				Result struct {
					URL string `json:"url"`
				} `json:"result"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&result)

			return e.JSON(200, map[string]any{
				"status": "deployed",
				"url":    result.Result.URL,
			})
		})

		return se.Next()
	})
	return nil
}
