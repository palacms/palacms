package internal

import (
	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
	_ "github.com/ncruces/go-sqlite3/vfs/memdb"
	"github.com/pocketbase/dbx"
)

var dbs = map[string]*dbx.DB{}

func DBConnect(dbPath string) (*dbx.DB, error) {
	if db, ok := dbs[dbPath]; ok {
		return db, nil
	}

	db, err := dbx.Open("sqlite3", "file::memory:?cache=shared&_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_pragma=journal_size_limit(200000000)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)&_pragma=temp_store(MEMORY)&_pragma=cache_size(-16000)")
	if err != nil {
		return nil, err
	}

	dbs[dbPath] = db
	return db, nil
}
