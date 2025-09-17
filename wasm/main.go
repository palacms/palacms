//go:build js && wasm

package main

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"syscall/js"

	"github.com/palacms/palacms/wasm/internal"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"

	palacms "github.com/palacms/palacms/internal"
	_ "github.com/palacms/palacms/migrations"
)

func main() {
	pb := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDev:     true,
		DefaultDataDir: "/pb_data",
		DBConnect:      internal.DBConnect,
	})

	pb.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			js.Global().Set("PB_REQUEST", js.FuncOf(func(this js.Value, args []js.Value) any {
				req := args[0]
				res := args[1]
				handle(e.Server.Handler, req, res)
				return nil
			}))
			return e.Next()
		},
	})

	if err := setup(pb); err != nil {
		log.Fatal(err)
	}

	if err := pb.Bootstrap(); err != nil {
		log.Fatal(err)
	}

	baseURL, err := url.Parse(js.Global().Get("location").Get("origin").String())
	if err != nil {
		log.Fatal(err)
	}

	if err := internal.Serve(pb, baseURL); err != nil {
		log.Fatal(err)
	}
}

func setup(pb *pocketbase.PocketBase) error {
	if err := palacms.RegisterValidation(pb); err != nil {
		return err
	}

	if err := palacms.RegisterEmailInvitation(pb); err != nil {
		return err
	}

	if err := palacms.RegisterInfoEndpoint(pb); err != nil {
		return err
	}

	if err := palacms.RegisterGenerateEndpoint(pb); err != nil {
		return err
	}

	if err := palacms.RegisterAdminApp(pb); err != nil {
		return err
	}

	if err := palacms.ServeSites(pb); err != nil {
		return err
	}

	if err := palacms.RegisterUsageStats(pb); err != nil {
		return err
	}

	return nil
}

func handle(handler http.Handler, req js.Value, res js.Value) {
	body := make([]byte, req.Get("body").Get("length").Int())
	js.CopyBytesToGo(body, req.Get("body"))
	request, err := http.NewRequest(
		req.Get("method").String(),
		req.Get("url").String(),
		bytes.NewReader(body),
	)
	if err != nil {
		log.Println(err)
		err = setErrorResponse(res)
		if err != nil {
			log.Println(err)
		}
		return
	}

	headers := req.Get("headers")
	count := headers.Get("length").Int()
	for i := range count {
		request.Header.Add(
			headers.Index(i).Index(0).String(),
			headers.Index(i).Index(1).String(),
		)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	response := recorder.Result()
	err = setResponse(res, response)
	if err != nil {
		log.Println(err)
		err = setErrorResponse(res)
		if err != nil {
			log.Println(err)
		}
	}
}

func setResponse(dst js.Value, src *http.Response) error {
	headers := []any{}
	for key, values := range src.Header {
		for _, value := range values {
			headers = append(headers, js.ValueOf([]any{key, value}))
		}
	}

	data, err := io.ReadAll(src.Body)
	if err != nil {
		return err
	}

	body := js.Global().Get("Uint8Array").New(len(data))
	js.CopyBytesToJS(body, data)

	dst.Set("status", src.StatusCode)
	dst.Set("statusText", src.Status)
	dst.Set("headers", headers)
	dst.Set("body", body)
	return nil
}

func setErrorResponse(dst js.Value) error {
	recorder := httptest.NewRecorder()
	recorder.WriteHeader(500)
	response := recorder.Result()
	return setResponse(dst, response)
}
