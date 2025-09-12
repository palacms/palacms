skipWaiting();
importScripts("fs.js");
importScripts("wasm_exec.js");
const go = new Go();
const result = WebAssembly.instantiateStreaming(
  fetch("main.wasm"),
  go.importObject,
)
  .then((result) => go.run(result.instance))
  .catch((error) => {
    console.error(error);
  });

self.addEventListener("fetch", (event) => {
  if (!PB_REQUEST) {
    return;
  }

  event.respondWith(
    event.request.arrayBuffer().then((buffer) => {
      const request = {
        method: event.request.method,
        url: event.request.url,
        headers: Array.from(event.request.headers),
        body: new Uint8Array(buffer),
      };
      const response = {};
      PB_REQUEST(request, response);
      return new Response(response.body, response);
    }),
  );
});
