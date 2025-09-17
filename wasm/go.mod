module github.com/palacms/palacms/wasm

go 1.24.5

replace modernc.org/sqlite => ./fake/sqlite

replace github.com/palacms/palacms => ../

require (
	github.com/fatih/color v1.18.0
	github.com/ncruces/go-sqlite3 v0.29.0
	github.com/ncruces/go-sqlite3/embed/bcw2 v0.24.0
	github.com/palacms/palacms v0.0.0-00010101000000-000000000000
	github.com/pocketbase/dbx v1.11.0
	github.com/pocketbase/pocketbase v0.30.0
	golang.org/x/crypto v0.42.0
)

require (
	github.com/asaskevich/govalidator v0.0.0-20230301143203-a9d515a09cc2 // indirect
	github.com/disintegration/imaging v1.6.2 // indirect
	github.com/dlclark/regexp2 v1.11.5 // indirect
	github.com/domodwyer/mailyak/v3 v3.6.2 // indirect
	github.com/dop251/goja v0.0.0-20250630131328-58d95d85e994 // indirect
	github.com/gabriel-vasile/mimetype v1.4.10 // indirect
	github.com/ganigeorgiev/fexpr v0.5.0 // indirect
	github.com/go-ozzo/ozzo-validation/v4 v4.3.0 // indirect
	github.com/go-sourcemap/sourcemap v2.1.4+incompatible // indirect
	github.com/golang-jwt/jwt/v5 v5.3.0 // indirect
	github.com/google/go-cmp v0.6.0 // indirect
	github.com/google/pprof v0.0.0-20250317173921-a4b03ec1a45e // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/ncruces/julianday v1.0.0 // indirect
	github.com/spf13/cast v1.10.0 // indirect
	github.com/spf13/cobra v1.10.1 // indirect
	github.com/spf13/pflag v1.0.10 // indirect
	github.com/tetratelabs/wazero v1.9.0 // indirect
	golang.org/x/image v0.31.0 // indirect
	golang.org/x/net v0.44.0 // indirect
	golang.org/x/oauth2 v0.31.0 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/sys v0.36.0 // indirect
	golang.org/x/text v0.29.0 // indirect
	modernc.org/sqlite v1.38.2 // indirect
)
