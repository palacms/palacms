package internal

import (
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
	"github.com/pocketbase/dbx"
)

var dbs = map[string]*dbx.DB{}

func DBConnect(dbPath string) (*dbx.DB, error) {
	if db, ok := dbs[dbPath]; ok {
		return db, nil
	}

	db, err := dbx.Open("sqlite3", "file:"+dbPath)
	if err != nil {
		return nil, err
	}

	dbs[dbPath] = db
	return db, nil
}
