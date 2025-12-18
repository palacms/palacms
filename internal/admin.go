package internal

import (
	"embed"
	"io/fs"
	"path"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

//go:embed build/*
var build embed.FS

func RegisterAdminApp(pb *pocketbase.PocketBase) error {
	subFs, err := fs.Sub(build, "build")
	if err != nil {
		return err
	}

	buildTime, err := getBuildTime()
	if err != nil {
		return err
	}

	appRoot := &timedFS{
		FS:           subFs,
		FixedModTime: buildTime,
	}

	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		setupCompleted := false

		serveEvent.InstallerFunc = func(app core.App, systemSuperuser *core.Record, baseURL string) error {
			systemSuperuser.SetPassword("public-secret")
			return pb.Save(systemSuperuser)
		}

		serveEvent.Router.GET(
			"/admin/{path...}",
			func(requestEvent *core.RequestEvent) error {
				if !setupCompleted {
					superuserCount, err := pb.CountRecords(
						"_superusers",
						dbx.Not(dbx.HashExp{
							"email": "__pbinstaller@example.com",
						}),
					)
					if err != nil {
						return err
					}

					setupRequired := superuserCount == 0
					isSetup := requestEvent.Request.URL.Path == "/admin/setup"
					isFile := path.Ext(requestEvent.Request.URL.Path) != ""
					if setupRequired && !isSetup && !isFile {
						return requestEvent.Redirect(302, "/admin/setup")
					} else {
						setupCompleted = true
					}
				}

				return apis.Static(appRoot, true)(requestEvent)
			},
		)

		return serveEvent.Next()
	})

	return nil
}
