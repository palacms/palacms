import { VERSION as SVELTE_VERSION } from 'svelte/compiler'

export const dynamic_iframe_srcdoc = (head, broadcast_id) => {
	return `
  <!DOCTYPE html>
  <html>
    <head>
      ${head}
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        import { mount, unmount } from "https://esm.sh/svelte@${SVELTE_VERSION}";

        let source;
        let c;

        const channel = new BroadcastChannel('${broadcast_id}');
        channel.onmessage = ({data}) => {
          const { event, payload = {} } = data
          if (payload.componentApp) {
            source = payload.componentApp
          }
          if (payload.data) {
            update(payload.data)
          }
        }
        channel.postMessage({ event: 'INITIALIZED' });

        function update(props) {
          // Reset logs and runtime error display in parent
          try { channel.postMessage({ event: 'BEGIN' }); } catch (_) {}

          // Install a safe console proxy that forwards logs to the parent
          (function setupConsoleBridge(){
            try {
              const methods = ['log','info','warn','error'];
              const original = Object.create(null);
              for (const m of methods) {
                const fn = (console && typeof console[m] === 'function') ? console[m].bind(console) : null;
                original[m] = fn;
              }

              const safeSerialize = (v) => {
                try { return JSON.parse(JSON.stringify(v)); } catch (_) { return typeof v === 'string' ? v : String(v); }
              };

              let timer = null;
              let lastQueued = undefined;
              let lastSent = undefined;
              const sendThrottled = (value) => {
                lastQueued = value;
                if (timer) return;
                timer = setTimeout(() => {
                  timer = null;
                  const payload = lastQueued;
                  const key = (()=>{ try { return JSON.stringify(payload);} catch(_) { return String(payload);} })();
                  if (key !== lastSent) {
                    try { channel.postMessage({ event: 'SET_CONSOLE_LOGS', payload: { logs: payload } }); } catch(_) {}
                    lastSent = key;
                  }
                }, 120);
              };

              for (const m of methods) {
                console[m] = (...args) => {
                  try {
                    const payload = args.length <= 1 ? safeSerialize(args[0]) : args.map(safeSerialize);
                    sendThrottled(payload);
                  } catch(_) {}
                  if (original[m]) try { original[m](...args); } catch(_) {}
                };
              }
            } catch(_) {
              // ignore logging bridge failures
            }
          })();

          const blob = new Blob([source], { type: 'text/javascript' });
          const url = URL.createObjectURL(blob);
          import(url).then(({ default: App }) => {
            if (c) unmount(c)
            try {
              c = mount(App, {
                target: document.querySelector('#page'),
                props
              })
              channel.postMessage({ event: 'MOUNTED' });
            } catch(e) {
              document.querySelector('#page').innerHTML = ''
              channel.postMessage({
                event: 'SET_ERROR',
                payload: {
                  error: e.toString()
                }
              });
            }
            try { URL.revokeObjectURL(url) } catch (_) {}
          })
        }
		  </script>
    </head>
    <body id="page"></body>
  </html>
`
}

export const static_iframe_srcdoc = ({ head = '', html, css, foot = '' }) => {
	return `
    <!DOCTYPE html>
    <html>
      <head>${head}</head>
      <body id="page" style="margin:0">
        ${html}
        <style>${css}</style>
        ${foot}
      </body>
    </html>
  `
}

export const component_iframe_srcdoc = ({ head = '', foot = '' }) => {
	return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <script type="module">
          import { mount, unmount } from "https://esm.sh/svelte@${SVELTE_VERSION}"

          let source;
          let c;

          window.addEventListener('message', ({ data }) => {
            const payload = data && data.payload
            if (!payload) return
            if (payload.js) {
              source = payload.js
            }
            if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
              update(payload.data)
            }
          })

          function update(props) {
            if (!source) return
            const target = document.querySelector('#component')
            if (!target) return

            const blob = new Blob([source], { type: 'text/javascript' })
            const url = URL.createObjectURL(blob)
            import(url)
              .then(({ default: App }) => {
                if (c) unmount(c)
                try {
                  c = mount(App, {
                    target,
                    props
                  })
                  window.parent.postMessage({ type: 'component-error', error: '' }, '*')
                } catch (e) {
                  target.innerHTML = ''
                  console.error(e)
                  const message = typeof e === 'string' ? e : e?.stack || e?.message || e?.toString?.() || 'Unknown error'
                  window.parent.postMessage({ type: 'component-error', error: String(message).split('\\n')[0] }, '*')
                }
              })
              .catch((e) => {
                target.innerHTML = ''
                console.error(e)
                const message = typeof e === 'string' ? e : e?.stack || e?.message || e?.toString?.() || 'Unknown error'
                window.parent.postMessage({ type: 'component-error', error: String(message).split('\\n')[0] }, '*')
              })
              .finally(() => {
                try { URL.revokeObjectURL(url) } catch (_) {}
              })
          }
        </script>
        ${head}
      </head>
      <body style="margin:0;overflow:hidden;">
        <div id="component"></div>
        ${foot}
        <style>
          [contenteditable="true"] { outline: 0 !important; }
        </style>
      </body>
    </html>
  `
}
