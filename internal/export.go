package internal

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

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
		se.Router.GET("/api/palacms/site-zip/{siteId}", func(e *core.RequestEvent) error {
			site, err := pb.FindRecordById("sites", e.Request.PathValue("siteId"))
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
		se.Router.POST("/api/palacms/deploy/{siteId}", func(e *core.RequestEvent) error {
			site, err := e.App.FindRecordById("sites", e.Request.PathValue("siteId"))
			if err != nil {
				return e.NotFoundError("site not found", err)
			}

			info, _ := e.RequestInfo()
			canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
			if !canAccess {
				return e.ForbiddenError("", nil)
			}

			// Parse optional branch name from request body
			var body struct {
				Branch string `json:"branch"`
			}
			if err := e.BindBody(&body); err != nil {
				// Body might be empty, that's fine
			}
			branch := body.Branch
			if branch == "" {
				branch = "main"
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
				return e.InternalServerError("cloudflare credentials missing", nil)
			}

			host := site.GetString("host")
			if strings.Contains(host, "/") || strings.Contains(host, "\\") || host == ".." {
				return e.BadRequestError("invalid host name", nil)
			}

			// The files are already generated and stored locally in PocketBase's data directory.
			siteDir := filepath.Join(e.App.DataDir(), "storage", "sites", host)

			ctx, cancel := context.WithTimeout(e.Request.Context(), 2*time.Minute)
			defer cancel()

			cmd := exec.CommandContext(ctx, "npx", "wrangler", "pages", "deploy", siteDir, "--project-name", proj, "--branch", branch)
			cmd.Env = append(os.Environ(),
				"CLOUDFLARE_ACCOUNT_ID="+acct,
				"CLOUDFLARE_API_TOKEN="+token,
				"WRANGLER_SEND_METRICS=false",
			)

			out, err := cmd.CombinedOutput()
			if err != nil {
				e.App.Logger().Error("cloudflare deployment failed", "error", err, "output", string(out))
				return e.InternalServerError("cloudflare deployment failed", nil)
			}

			return e.JSON(200, map[string]any{
				"status": "deployed",
				"url":    "https://" + proj + ".pages.dev",
			})
		})

		return se.Next()
	})
	return nil
}
