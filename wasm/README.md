# PalaCMS WASM

- Runs Pocketbase inside a browser using WebAssembly
- Uses service worker to handle requests

## Building and running

1. Copy wasm_exec.js glue code from Go:

   ```
   cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" wasm/web/
   ```

2. Build:

   ```
   GOOS=js GOARCH=wasm go build -C wasm -o web/palacms.wasm --tags sqlite3_dotlk
   ```

3. Start a HTTP server which has a fallback to index.html:

   ```
   npx serve --single wasm/web/
   ```

4. Open a browser to admin dashboard:

   ```
   firefox http://localhost:3000/
   ```
