# PalaCMS WASM

- Runs Pocketbase inside a browser using WebAssembly
- Uses service worker to handle requests
- Uses a temporary memory database

## Building and running

1. Copy wasm_exec.js glue code from Go:

   ```
   cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" .
   ```

2. Build:

   ```
   GOOS=js GOARCH=wasm go build -o main.wasm
   ```

3. Start a HTTP server which has a fallback to index.html:

   ```
   npx serve --single
   ```

4. Open a browser to admin dashboard:

   ```
   firefox http://localhost:3000/_/
   ```

5. Pocketbase starts on the first load. Refresh the page to get to the login screen.
