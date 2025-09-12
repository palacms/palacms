package internal

import (
	"database/sql"
	"errors"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func loadInstaller(
	app core.App,
	baseURL string,
	installerFunc func(app core.App, systemSuperuser *core.Record, baseURL string) error,
) error {
	if installerFunc == nil || !needInstallerSuperuser(app) {
		return nil
	}

	superuser, err := findOrCreateInstallerSuperuser(app)
	if err != nil {
		return err
	}

	return installerFunc(app, superuser, baseURL)
}

func needInstallerSuperuser(app core.App) bool {
	total, err := app.CountRecords(core.CollectionNameSuperusers, dbx.Not(dbx.HashExp{
		"email": core.DefaultInstallerEmail,
	}))

	return err == nil && total == 0
}

func findOrCreateInstallerSuperuser(app core.App) (*core.Record, error) {
	col, err := app.FindCachedCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return nil, err
	}

	record, err := app.FindAuthRecordByEmail(col, core.DefaultInstallerEmail)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}

		record = core.NewRecord(col)
		record.SetEmail(core.DefaultInstallerEmail)
		record.SetRandomPassword()

		err = app.Save(record)
		if err != nil {
			return nil, err
		}
	}

	return record, nil
}
