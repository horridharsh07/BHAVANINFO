const { spawn } = require('child_process');
const net = require('net');

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9337;
  const userDataDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\6d95dcb3-4136-43af-bbf3-966d4eb09f03\\scratch\\edge_debug_map_html';
  
  const edge = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--window-size=1920,1080',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    'http://localhost:3000/'
  ]);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const tabs = await res.json();
        const pageTab = tabs.find(t => t.type === 'page');
        if (pageTab) {
          await debugMap(pageTab.webSocketDebuggerUrl);
        }
        break;
      }
    } catch (e) {}
  }

  try { edge.kill('SIGKILL'); } catch (e) {}
  process.exit(0);
}

function debugMap(wsUrl) {
  return new Promise((resolve) => {
    const url = new URL(wsUrl);
    const client = net.connect({ host: url.hostname, port: parseInt(url.port) }, () => {
      const key = Buffer.from('test-key-12345678').toString('base64');
      const req = [
        `GET ${url.pathname} HTTP/1.1`,
        `Host: ${url.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '\r\n'
      ].join('\r\n');
      client.write(req);
    });

    let buffer = Buffer.alloc(0);
    let msgId = 1;
    const callbacks = new Map();

    function sendCommand(method, params = {}) {
      const id = msgId++;
      const msg = JSON.stringify({ id, method, params });
      const payload = Buffer.from(msg);
      let header;
      if (payload.length < 126) {
        header = Buffer.from([0x81, 0x80 | payload.length, 0x12, 0x34, 0x56, 0x78]);
      } else {
        header = Buffer.from([0x81, 0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff, 0x12, 0x34, 0x56, 0x78]);
      }
      const mask = header.slice(-4);
      const maskedPayload = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i++) {
        maskedPayload[i] = payload[i] ^ mask[i % 4];
      }
      client.write(Buffer.concat([header, maskedPayload]));
      return new Promise((res) => callbacks.set(id, res));
    }

    client.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.includes(Buffer.from('\r\n\r\n'))) {
        const idx = buffer.indexOf(Buffer.from('\r\n\r\n'));
        const headerStr = buffer.slice(0, idx).toString();
        if (headerStr.startsWith('HTTP/1.1 101')) {
          buffer = buffer.slice(idx + 4);
          onHandshake();
        }
      }

      while (buffer.length >= 2) {
        const b1 = buffer[0];
        const b2 = buffer[1];
        const opcode = b1 & 0x0f;
        let payloadLen = b2 & 0x7f;
        let offset = 2;
        if (payloadLen === 126) {
          if (buffer.length < 4) break;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) break;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }
        if (buffer.length < offset + payloadLen) break;
        const payloadData = buffer.slice(offset, offset + payloadLen);
        buffer = buffer.slice(offset + payloadLen);

        if (opcode === 1) {
          try {
            const data = JSON.parse(payloadData.toString());
            if (data.id && callbacks.has(data.id)) {
              callbacks.get(data.id)(data.result);
              callbacks.delete(data.id);
            } else if (data.method === 'Runtime.consoleAPICalled') {
              console.log(`[Browser Console ${data.params.type}]`, ...data.params.args.map(a => a.value || a.description || JSON.stringify(a)));
            } else if (data.method === 'Runtime.exceptionThrown') {
              console.error('[Browser Exception]', data.params.exceptionDetails);
            }
          } catch (e) {}
        }
      }
    });

    async function onHandshake() {
      await sendCommand('Console.enable');
      await sendCommand('Runtime.enable');
      await new Promise(r => setTimeout(r, 2000));

      const res = await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          try {
            window.app.loginUser();
            window.app.switchView('map');

            const mapObj = window.app.map2d;
            const mapEl = document.getElementById('cadastre-map');
            return {
              hasMap2d: !!mapObj,
              hasInnerMap: !!(mapObj && mapObj.map),
              mapLoaded: mapObj ? mapObj.isLoaded : false,
              mapElHTML: mapEl ? mapEl.outerHTML.slice(0, 300) : null,
              mapElParent: mapEl && mapEl.parentElement ? mapEl.parentElement.className : null,
              mapElComputed: mapEl ? {
                display: window.getComputedStyle(mapEl).display,
                width: window.getComputedStyle(mapEl).width,
                height: window.getComputedStyle(mapEl).height,
                visibility: window.getComputedStyle(mapEl).visibility
              } : null
            };
          } catch(err) {
            return { error: err.message, stack: err.stack };
          }
        })()`,
        returnByValue: true
      });
      console.log('Map switch diagnostic:', res.result.value);

      // Check what maplibregl.Map did
      const res2 = await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          const map = window.app.map2d ? window.app.map2d.map : null;
          if (!map) return { noMap: true };
          return {
            hasContainer: !!map.getContainer(),
            containerChildren: map.getContainer().children.length,
            containerInnerHTML: map.getContainer().innerHTML.slice(0, 300),
            getCanvas: !!map.getCanvas(),
            getCanvasContainer: !!map.getCanvasContainer()
          };
        })()`,
        returnByValue: true
      });
      console.log('MapLibre internal container:', res2.result.value);

      resolve();
    }
  });
}

run();
