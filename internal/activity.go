package internal

import (
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

const userActivityCleanupInterval = 10 * time.Second
const userActivityCleanupThreshold = 10 * time.Second

func cleanupUserActivity(pb *pocketbase.PocketBase) error {
	oldActivities, err := pb.FindRecordsByFilter(
		"user_activities",
		"updated < {:min}",
		"-updated",
		10,
		0,
		dbx.Params{
			"min": time.Now().UTC().Add(-userActivityCleanupThreshold).Format("2006-01-02 15:04:05.000Z"),
		},
	)
	if err != nil {
		return err
	}

	for _, activity := range oldActivities {
		if err := pb.Delete(activity); err != nil {
			return err
		}
	}
	return nil
}

func RegisterUserActivity(pb *pocketbase.PocketBase) error {
	var terminated chan bool
	pb.OnTerminate().BindFunc(func(terminateEvent *core.TerminateEvent) error {
		if terminated != nil {
			terminated <- true
		}
		return terminateEvent.Next()
	})

	pb.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		terminated := make(chan bool)

		// Spawn goroutine for cleanup
		go func() {
			ticker := time.NewTicker(userActivityCleanupInterval)
			for {
				select {
				case <-terminated:
					return

				case <-ticker.C:
					if err := cleanupUserActivity(pb); err != nil {
						pb.Logger().Error(
							"User activity cleanup failed, breaking the loop",
							"error", err,
						)
						return
					}
				}
			}
		}()

		return serveEvent.Next()
	})

	return nil
}
