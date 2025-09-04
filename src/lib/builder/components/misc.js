export const dynamic_iframe_srcdoc = (head = '') => {
	return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      ${head}
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        import { mount, unmount } from "https://esm.sh/svelte";

        let source;
        let c;

        const channel = new BroadcastChannel('component_preview');
        // Mock inspector overlay (multiple boxes)
        let overlayEnabled = true;
        let overlayContainer;
        let overlays = [];
        function getOverlayContainer() {
          if (!overlayContainer) {
            overlayContainer = document.createElement('div');
            overlayContainer.id = '__pala_inspector_overlay_container';
            Object.assign(overlayContainer.style, {
              position: 'absolute',
              top: '0px', left: '0px',
              width: '0px', height: '0px',
              pointerEvents: 'none',
              zIndex: 2147483647,
            });
            document.body.appendChild(overlayContainer);
          }
          return overlayContainer;
        }
        function getOverlayAt(i) {
          const container = getOverlayContainer();
          if (!overlays[i]) {
            const box = document.createElement('div');
            Object.assign(box.style, {
              position: 'absolute',
              border: '2px solid #60a5fa',
              background: 'rgba(96,165,250,0.12)',
              pointerEvents: 'none',
              transition: 'all 0.06s ease-out'
            });
            container.appendChild(box);
            overlays[i] = box;
          }
          return overlays[i];
        }
        function hideExtraOverlays(startIndex) {
          for (let i = startIndex; i < overlays.length; i++) {
            const box = overlays[i];
            if (box) {
              box.style.width = '0px';
              box.style.height = '0px';
            }
          }
        }
        let __pala_last_line = null;
        function highlightLineInPreview(line) {
          try {
            if (!line) return;
            __pala_last_line = line;
            const nodes = document.querySelectorAll('[data-primo-loc="' + line + '"]');
            if (!nodes || nodes.length === 0) { hideExtraOverlays(0); return; }
            let i = 0;
            for (const el of nodes) {
              const rect = el.getBoundingClientRect();
              const ov = getOverlayAt(i++);
              ov.style.top = (window.scrollY + rect.top) + 'px';
              ov.style.left = (window.scrollX + rect.left) + 'px';
              ov.style.width = rect.width + 'px';
              ov.style.height = rect.height + 'px';
            }
            hideExtraOverlays(i);
          } catch (_) {}
        }

        channel.onmessage = ({data}) => {
          const { event, payload = {} } = data
          if (payload.componentApp) {
            source = payload.componentApp
          }
          if (payload.data) {
            update(payload.data)
          }
          if (event === 'INSPECTOR_TOGGLE' && typeof payload.enabled === 'boolean') {
            overlayEnabled = payload.enabled;
            if (!overlayEnabled) hideExtraOverlays(0);
          }
          if (event === 'HOVER_LOC' && payload?.line) {
            if (overlayEnabled) highlightLineInPreview(payload.line)
          }
        }

        // Keep overlay aligned on scroll/resize
        window.addEventListener('scroll', () => { if (__pala_last_line) highlightLineInPreview(__pala_last_line) }, { passive: true });
        window.addEventListener('resize', () => { if (__pala_last_line) highlightLineInPreview(__pala_last_line) });

        function update(props) {
          const withLogs = \`
            const channel = new BroadcastChannel('component_preview');
            const primoLog = console ? console.log.bind(console) : null;
            const primoError = console ? console.error.bind(console) : null;
            function postMessage(logs) {
              channel.postMessage({
                event: 'SET_CONSOLE_LOGS',
                payload: { logs }
              });
            }

            // Throttled sender to avoid flooding the channel with repeated logs/errors
            function createThrottledSender(interval = 120) {
              let timer = null;
              let lastQueued = undefined;
              let lastSent = undefined;
              const same = (a, b) => {
                try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return a === b; }
              };
              return (value) => {
                lastQueued = value;
                if (timer) return;
                timer = setTimeout(() => {
                  timer = null;
                  if (!same(lastQueued, lastSent)) {
                    channel.postMessage({
                      event: 'SET_CONSOLE_LOGS',
                      payload: { logs: lastQueued }
                    });
                    lastSent = lastQueued;
                  }
                }, interval);
              };
            }

            const sendLogs = createThrottledSender(120);

            // Throttled hover-to-code mapper
            function createLocThrottler(interval = 60) {
              let timer = null;
              let last = null;
              return (loc) => {
                last = loc;
                if (timer) return;
                timer = setTimeout(() => {
                  timer = null;
                  if (last && typeof last.line === 'number') {
                    channel.postMessage({ event: 'SET_ELEMENT_PATH', payload: { loc: last } });
                  }
                }, interval);
              };
            }
            const sendLoc = createLocThrottler(80);

            // Note: CSS mapping (element => CSS selector => rule line) is not enabled yet.
            // A future iteration may post a target (id/classes) and resolve to CSS editor lines.

            channel.postMessage({ event: 'BEGIN' });
            if (primoLog) console.log = (...args) => {
              try {
                sendLogs(args.length <= 1 ? args[0] : args);
              } catch (e) {
                // fall back to a simple string to avoid cyclic structures
                try { channel.postMessage({ event: 'SET_CONSOLE_LOGS', payload: { logs: 'Could not serialize console.log args' } }); } catch (_) {}
              }
              primoLog(...args);
            };
            if (primoError) console.error = (...args) => {
              try {
                sendLogs(args.length <= 1 ? args[0] : args);
              } catch (e) {
                try { channel.postMessage({ event: 'SET_CONSOLE_LOGS', payload: { logs: 'Could not serialize console.error args' } }); } catch (_) {}
              }
              primoError(...args);
            };

            // Try to read Svelte dev loc from hovered elements
            function extractLocFrom(el) {
              try {
                if (!el) return null;
                const attr = el.getAttribute && el.getAttribute('data-primo-loc');
                if (attr) {
                  const n = Number(attr);
                  if (!Number.isNaN(n)) return { line: n };
                }
                const meta = el.__svelte_meta || el.__svelte;
                if (meta && meta.loc) {
                  // Svelte dev sometimes exposes { line, column }
                  if (typeof meta.loc.line === 'number') return { line: meta.loc.line };
                }
                if (meta && meta.start && typeof meta.start.line === 'number') {
                  return { line: meta.start.line };
                }
              } catch(_) {}
              return null;
            }
            function onHover(e) {
              let el = e.target;
              for (let i=0; i<12 && el; i++) {
                const loc = extractLocFrom(el);
                if (loc) { sendLoc(loc); break; }
                // CSS target posting intentionally disabled for now (see note above).
                el = el.parentElement;
              }
            }
            window.addEventListener('mousemove', onHover, { passive: true });
            \` + source;
          const blob = new Blob([withLogs], { type: 'text/javascript' });
          const url = URL.createObjectURL(blob);
          import(url).then(({ default: App }) => {
            if (c) unmount(c)
            try {
              c = mount(App, {
                target: document.querySelector('#page'),
                props
              })
            } catch(e) {
              document.querySelector('#page').innerHTML = ''
              console.error(e.toString())
              channel.postMessage({
                event: 'SET_ERROR',
                payload: {
                  error: e.toString()
                }
              });
            }
          }).catch((e) => {
            try {
              console.error(e?.toString?.() || 'Import error');
              channel.postMessage({ event: 'SET_ERROR', payload: { error: e?.toString?.() || 'Import error' } });
            } catch (_) {}
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
    <html lang="en">
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
    <html lang="en">
      <head>
        <script type="module">
          import { mount, unmount } from "https://esm.sh/svelte"

          let source;
          let c;

          window.addEventListener('message', ({data}) => {
            // handle the message here
            const { payload } = data
            if (payload?.js) {
              source = payload.js
            }
            if (payload?.data) {
              update(payload.data)
            }
          })

          function update(props) {
            const blob = new Blob([source], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            import(url).then(({ default: App }) => {
              if (c) unmount(c)
              try {
                c = mount(App, {
                  target: document.querySelector('#component'),
                  props
                })
              } catch(e) {
                document.querySelector('#component').innerHTML = ''
                console.error(e.toString())
              }
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
