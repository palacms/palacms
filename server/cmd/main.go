package main

import (
	"log"

	"github.com/palacms/palacms/server"
	_ "github.com/palacms/palacms/server/migrations"
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
	if err := server.RegisterValidation(pb); err != nil {
		return err
	}

	if err := server.RegisterEmailInvitation(pb); err != nil {
		return err
	}

	if err := server.RegisterInfoEndpoint(pb); err != nil {
		return err
	}

	if err := server.RegisterGenerateEndpoint(pb); err != nil {
		return err
	}

	if err := server.RegisterAdminApp(pb); err != nil {
		return err
	}

	if err := server.ServeSites(pb); err != nil {
		return err
	}

	if err := server.RegisterUsageStats(pb); err != nil {
		return err
	}

	return nil
}
