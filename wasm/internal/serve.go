package internal

import (
	"context"
	"crypto/tls"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/routine"
	"github.com/pocketbase/pocketbase/ui"
	"golang.org/x/crypto/acme"
)

func Serve(app core.App, baseURL *url.URL) error {
	pbRouter, err := apis.NewRouter(app)
	if err != nil {
		return err
	}

	pbRouter.GET("/_/{path...}", apis.Static(ui.DistDirFS, false)).
		BindFunc(func(e *core.RequestEvent) error {
			// ignore root path
			if e.Request.PathValue(apis.StaticWildcardParam) != "" {
				e.Response.Header().Set("Cache-Control", "max-age=1209600, stale-while-revalidate=86400")
			}

			// add a default CSP
			if e.Response.Header().Get("Content-Security-Policy") == "" {
				e.Response.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' http://127.0.0.1:* https://tile.openstreetmap.org data: blob:; connect-src 'self' http://127.0.0.1:* https://nominatim.openstreetmap.org; script-src 'self' 'sha256-GRUzBA7PzKYug7pqxv5rJaec5bwDCw1Vo6/IXwvD3Tc='")
			}

			return e.Next()
		})

	// base request context used for cancelling long running requests
	// like the SSE connections
	baseCtx, cancelBaseCtx := context.WithCancel(context.Background())
	defer cancelBaseCtx()

	server := &http.Server{
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			NextProtos: []string{acme.ALPNProto},
		},
		// higher defaults to accommodate large file uploads/downloads
		WriteTimeout:      5 * time.Minute,
		ReadTimeout:       5 * time.Minute,
		ReadHeaderTimeout: 1 * time.Minute,
		Addr:              baseURL.Host,
		BaseContext: func(l net.Listener) context.Context {
			return baseCtx
		},
		ErrorLog: log.New(&serverErrorLogWriter{app: app}, "", 0),
	}
	serveEvent := new(core.ServeEvent)
	serveEvent.App = app
	serveEvent.Router = pbRouter
	serveEvent.Server = server
	serveEvent.InstallerFunc = apis.DefaultInstallerFunc

	serveHookErr := app.OnServe().Trigger(serveEvent, func(e *core.ServeEvent) error {
		handler, err := e.Router.BuildMux()
		if err != nil {
			return err
		}

		e.Server.Handler = handler

		if e.InstallerFunc != nil {
			app := e.App
			installerFunc := e.InstallerFunc
			routine.FireAndForget(func() {
				if err := loadInstaller(app, baseURL.String(), installerFunc); err != nil {
					app.Logger().Warn("Failed to initialize installer", "error", err)
				}
			})
		}

		return nil
	})
	if serveHookErr != nil {
		return serveHookErr
	}

	date := new(strings.Builder)
	log.New(date, "", log.LstdFlags).Print()

	bold := color.New(color.Bold).Add(color.FgGreen)
	bold.Printf(
		"%s Server started at %s\n",
		strings.TrimSpace(date.String()),
		color.CyanString("%s", baseURL),
	)

	regular := color.New()
	regular.Printf("├─ REST API:  %s\n", color.CyanString("%s/api/", baseURL))
	regular.Printf("└─ Dashboard: %s\n", color.CyanString("%s/_/", baseURL))

	// wait indefinitely instead of listening
	wait := make(chan any)
	<-wait

	return nil
}

type serverErrorLogWriter struct {
	app core.App
}

func (s *serverErrorLogWriter) Write(p []byte) (int, error) {
	s.app.Logger().Debug(strings.TrimSpace(string(p)))

	return len(p), nil
}
