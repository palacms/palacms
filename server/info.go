package server

import (
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
)

// Get version
func getVersion() string {
	return os.Getenv("PALA_VERSION") // or unknown
}

// Get or create unique instance ID
func getInstanceId(pb *pocketbase.PocketBase) (string, error) {
	collection, err := pb.FindCollectionByNameOrId("telemetry_values")
	if err != nil {
		return "", err
	}

	var instanceId string
	record, err := pb.FindFirstRecordByData(collection.Id, "key", "instance_id")
	if err != nil {
		// ID not found, let's create it
		instanceId = security.RandomString(20)
		record = core.NewRecord(collection)
		record.Set("key", "instance_id")
		record.Set("value", instanceId)
		if err := pb.Save(record); err != nil {
			return "", err
		}
	} else {
		instanceId = record.GetString("value")
		if instanceId == "" {
			// Empty ID, let's fill it
			instanceId = security.RandomString(20)
			record.Set("value", instanceId)
			if err := pb.Save(record); err != nil {
				return "", err
			}
		}
	}

	return instanceId, nil
}

func RegisterInfoEndpoint(pb *pocketbase.PocketBase) error {
	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.GET("/api/palacms/info", func(requestEvent *core.RequestEvent) error {
			id, err := getInstanceId(pb)
			if err != nil {
				return err
			}

			version := getVersion()
			telemetryEnabled := isUsageStateEnabled()
			return requestEvent.JSON(200, struct {
				Id               string `json:"id"`
				Version          string `json:"version"`
				TelemetryEnabled bool   `json:"telemetry_enabled"`
			}{
				Id:               id,
				Version:          version,
				TelemetryEnabled: telemetryEnabled,
			})
		})

		return serveEvent.Next()
	})

	return nil
}
