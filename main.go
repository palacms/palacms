package main

import (
	"log"

	"github.com/palacms/palacms/internal"
	_ "github.com/palacms/palacms/migrations"
	"github.com/pocketbase/pocketbase"
)

func main() {
	pb := pocketbase.New()

	if err := setup(pb); err != nil {
		log.Fatal(err)
	}

	if err := pb.Start(); err != nil {
		log.Fatal(err)
	}
}

func setup(pb *pocketbase.PocketBase) error {
	if err := internal.RegisterValidation(pb); err != nil {
		return err
	}

	if err := internal.RegisterEmailInvitation(pb); err != nil {
		return err
	}

	if err := internal.RegisterAdminApp(pb); err != nil {
		return err
	}

	if err := internal.RegisterInfo(pb); err != nil {
		return err
	}

	if err := internal.ServeSites(pb); err != nil {
		return err
	}

	if err := internal.RegisterUsageStats(pb); err != nil {
		return err
	}

	return nil
}
