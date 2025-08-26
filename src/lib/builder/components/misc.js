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
        channel.onmessage = ({data}) => {
          const { event, payload = {} } = data
          if (payload.componentApp) {
            source = payload.componentApp
          }
          if (payload.data) {
            update(payload.data)
          }
        }

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
            channel.postMessage({ event: 'BEGIN' });
            if (primoLog) console.log = (...args) => { try {postMessage(...args)}catch(e){postMessage('Could not print ' + typeof(args) + '. See in console.')}; primoLog(...args); };
            if (primoLog) console.error = (...args) => { try {postMessage(...args)}catch(e){postMessage('Could not print ' + typeof(args) + '. See in console.')}; primoError(...args); };
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
