package server

import (
	_ "embed"

	"github.com/dop251/goja"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"
)

//go:embed common/index.cjs
var commonScript string

func RegisterValidation(pb *pocketbase.PocketBase) error {
	vm := goja.New()
	if _, err := vm.RunString("exports = {};"); err != nil {
		return err
	}
	if _, err := vm.RunString(commonScript); err != nil {
		return err
	}
	models := vm.GlobalObject().
		Get("exports").ToObject(vm).
		Get("models").ToObject(vm)

	// Workaround Zod errors with file schema
	if _, err := vm.RunString("class File {};"); err != nil {
		return err
	}

	pb.OnRecordValidate().BindFunc(func(event *core.RecordEvent) error {
		var err error

		// Select model for validation
		collection := event.Record.Collection()
		model := models.Get(collection.Name)
		if model == nil {
			return event.Next()
		}
		validate, ok := goja.AssertFunction(model.ToObject(vm).Get("parse"))
		if !ok {
			return event.Next()
		}

		// Gather and parse values
		values := vm.NewObject()
		for _, field := range collection.Fields {
			name := field.GetName()
			value := event.Record.Get(name)

			if field.Type() == "json" {
				val := value.(types.JSONRaw)
				value, err = vm.RunString("(" + val.String() + ")")
				if err != nil {
					return err
				}
			}

			if field.Type() == "file" {
				// File fields are validated as strings of filenames
				switch val := value.(type) {
				case []*filesystem.File:
					names := make([]string, len(val))
					for index, file := range val {
						names[index] = file.Name
					}
					value = names
				case *filesystem.File:
					value = val.Name
				}
			}

			values.Set(name, value)
		}

		// Validate
		_, err = validate(goja.Undefined(), values)
		if err != nil {
			return err
		}

		return event.Next()
	})

	return nil
}
