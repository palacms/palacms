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

	"github.com/pocketbase/dbx"
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

		// check deployment status (presence and age of preview files)
		se.Router.GET("/api/palacms/deploy-status/{siteId}", func(e *core.RequestEvent) error {
			site, err := e.App.FindRecordById("sites", e.Request.PathValue("siteId"))
			if err != nil {
				return e.NotFoundError("site not found", err)
			}

			info, _ := e.RequestInfo()
			canAccess, _ := e.App.CanAccessRecord(site, info, site.Collection().UpdateRule)
			if !canAccess {
				return e.ForbiddenError("", nil)
			}

			host := site.GetString("host")
			siteDir := filepath.Join(e.App.DataDir(), "storage", "sites", host)

			// Get the latest update across all site-related collections
			lastUpdated := site.GetDateTime("updated").Time().UTC()

			// DB timestamp format: 2006-01-02 15:04:05.000Z
			dbTimeFormat := "2006-01-02 15:04:05.000Z"

			// Check site-linked collections (direct)
			directSiteCollections := []string{
				"pages",
				"site_symbols",
				"site_uploads",
				"site_fields",
				"site_groups",
			}
			for _, collName := range directSiteCollections {
				var maxTime struct {
					MaxT string `db:"max_t"`
				}
				err := e.App.DB().
					Select(fmt.Sprintf("MAX(%s.updated) as max_t", collName)).
					From(collName).
					Where(dbx.HashExp{"site": site.Id}).
					One(&maxTime)

				if err == nil && maxTime.MaxT != "" {
					t, err := time.Parse(dbTimeFormat, maxTime.MaxT)
					if err == nil && t.UTC().After(lastUpdated) {
						lastUpdated = t.UTC()
					}
				}
			}

			// Check collections linked through site_fields (site_entries)
			var maxSiteEntryTime struct {
				MaxT string `db:"max_t"`
			}
			err = e.App.DB().
				Select("MAX(site_entries.updated) as max_t").
				From("site_entries").
				Join("JOIN", "site_fields", dbx.NewExp("site_entries.field = site_fields.id")).
				Where(dbx.HashExp{"site_fields.site": site.Id}).
				One(&maxSiteEntryTime)
			if err == nil && maxSiteEntryTime.MaxT != "" {
				t, err := time.Parse(dbTimeFormat, maxSiteEntryTime.MaxT)
				if err == nil && t.UTC().After(lastUpdated) {
					lastUpdated = t.UTC()
				}
			}

			// Check collections linked through site_symbols (site_symbol_fields)
			var maxSiteSymbolFieldTime struct {
				MaxT string `db:"max_t"`
			}
			err = e.App.DB().
				Select("MAX(site_symbol_fields.updated) as max_t").
				From("site_symbol_fields").
				Join("JOIN", "site_symbols", dbx.NewExp("site_symbol_fields.symbol = site_symbols.id")).
				Where(dbx.HashExp{"site_symbols.site": site.Id}).
				One(&maxSiteSymbolFieldTime)
			if err == nil && maxSiteSymbolFieldTime.MaxT != "" {
				t, err := time.Parse(dbTimeFormat, maxSiteSymbolFieldTime.MaxT)
				if err == nil && t.UTC().After(lastUpdated) {
					lastUpdated = t.UTC()
				}
			}

			// Check collections linked through site_symbol_fields (site_symbol_entries)
			// site_symbol_entries -> field (site_symbol_fields) -> symbol (site_symbols) -> site
			var maxSiteSymbolEntryTime struct {
				MaxT string `db:"max_t"`
			}
			err = e.App.DB().
				Select("MAX(site_symbol_entries.updated) as max_t").
				From("site_symbol_entries").
				Join("JOIN", "site_symbol_fields", dbx.NewExp("site_symbol_entries.field = site_symbol_fields.id")).
				Join("JOIN", "site_symbols", dbx.NewExp("site_symbol_fields.symbol = site_symbols.id")).
				Where(dbx.HashExp{"site_symbols.site": site.Id}).
				One(&maxSiteSymbolEntryTime)
			if err == nil && maxSiteSymbolEntryTime.MaxT != "" {
				t, err := time.Parse(dbTimeFormat, maxSiteSymbolEntryTime.MaxT)
				if err == nil && t.UTC().After(lastUpdated) {
					lastUpdated = t.UTC()
				}
			}

			// Check collections linked through pages (page_entries, page_sections)
			pageCollections := []string{"page_entries", "page_sections"}
			for _, collName := range pageCollections {
				var maxTime struct {
					MaxT string `db:"max_t"`
				}
				err = e.App.DB().
					Select(fmt.Sprintf("MAX(%s.updated) as max_t", collName)).
					From(collName).
					Join("JOIN", "pages", dbx.NewExp(fmt.Sprintf("%s.page = pages.id", collName))).
					Where(dbx.HashExp{"pages.site": site.Id}).
					One(&maxTime)

				if err == nil && maxTime.MaxT != "" {
					t, err := time.Parse(dbTimeFormat, maxTime.MaxT)
					if err == nil && t.UTC().After(lastUpdated) {
						lastUpdated = t.UTC()
					}
				}
			}

			// Check collections linked through page_sections (page_section_entries)
			// page_section_entries -> section (page_sections) -> page (pages) -> site
			var maxPageSectionEntryTime struct {
				MaxT string `db:"max_t"`
			}
			err = e.App.DB().
				Select("MAX(page_section_entries.updated) as max_t").
				From("page_section_entries").
				Join("JOIN", "page_sections", dbx.NewExp("page_section_entries.section = page_sections.id")).
				Join("JOIN", "pages", dbx.NewExp("page_sections.page = pages.id")).
				Where(dbx.HashExp{"pages.site": site.Id}).
				One(&maxPageSectionEntryTime)
			if err == nil && maxPageSectionEntryTime.MaxT != "" {
				t, err := time.Parse(dbTimeFormat, maxPageSectionEntryTime.MaxT)
				if err == nil && t.UTC().After(lastUpdated) {
					lastUpdated = t.UTC()
				}
			}

			infoDir, err := os.Stat(siteDir)
			if err != nil {
				if os.IsNotExist(err) {
					return e.JSON(200, map[string]any{
						"exists":      false,
						"lastUpdated": lastUpdated.Format(time.RFC3339),
						"isOutdated":  true,
					})
				}
				return e.InternalServerError("failed to inspect preview files", err)
			}

			// find the newest file to determine generation time
			var lastGenerated time.Time
			if err := filepath.Walk(siteDir, func(path string, info os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				if !info.IsDir() {
					modTime := info.ModTime().UTC()
					if modTime.After(lastGenerated) {
						lastGenerated = modTime
					}
				}
				return nil
			}); err != nil {
				return e.InternalServerError("failed to scan preview files", err)
			}

			if lastGenerated.IsZero() {
				lastGenerated = infoDir.ModTime().UTC()
			}

			isOutdated := lastUpdated.After(lastGenerated)

			e.App.Logger().Info("Deployment status check",
				"site", host,
				"lastUpdated", lastUpdated.Format(time.RFC3339Nano),
				"lastGenerated", lastGenerated.Format(time.RFC3339Nano),
				"isOutdated", isOutdated,
			)

			return e.JSON(200, map[string]any{
				"exists":        true,
				"lastGenerated": lastGenerated.Format(time.RFC3339),
				"lastUpdated":   lastUpdated.Format(time.RFC3339),
				"isOutdated":    isOutdated,
			})
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

			url := "https://" + proj + ".pages.dev"
			if branch != "main" {
				url = "https://" + branch + "." + proj + ".pages.dev"
			}

			return e.JSON(200, map[string]any{
				"status": "deployed",
				"url":    url,
			})
		})

		return se.Next()
	})
	return nil
}
