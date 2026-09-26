const { spawn } = require('child_process');
const net = require('net');

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9336;
  const userDataDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\6d95dcb3-4136-43af-bbf3-966d4eb09f03\\scratch\\edge_debug_map';
  
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
          await testMap(pageTab.webSocketDebuggerUrl);
        }
        break;
      }
    } catch (e) {}
  }

  try { edge.kill('SIGKILL'); } catch (e) {}
  process.exit(0);
}

function testMap(wsUrl) {
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
      await new Promise(r => setTimeout(r, 1000));

      const res = await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          try {
            const testCanvas = document.createElement('canvas');
            const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
            const mapEl = document.getElementById('cadastre-map');
            
            let mapLibreSupported = false;
            try {
              mapLibreSupported = maplibregl.supported();
            } catch(e) {
              mapLibreSupported = 'Error: ' + e.message;
            }

            return {
              hasWebGL: !!gl,
              webglVendor: gl ? gl.getParameter(gl.VENDOR) : null,
              webglRenderer: gl ? gl.getParameter(gl.RENDERER) : null,
              mapLibreSupported,
              mapElExists: !!mapEl,
              mapChildren: mapEl ? mapEl.children.length : 0,
              mapInnerHTML: mapEl ? mapEl.innerHTML.slice(0, 150) : null
            };
          } catch(err) {
            return { error: err.message, stack: err.stack };
          }
        })()`,
        returnByValue: true
      });
      console.log('WebGL & MapLibre Support check:', res.result.value);

      // Now try to instantiate MapLibre directly with try/catch and log all events:
      const res2 = await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          try {
            const el = document.getElementById('cadastre-map');
            el.style.width = '800px';
            el.style.height = '600px';
            const m = new maplibregl.Map({
              container: 'cadastre-map',
              style: {
                version: 8,
                sources: {
                  'osm': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256
                  }
                },
                layers: [{
                  id: 'osm',
                  type: 'raster',
                  source: 'osm'
                }]
              },
              center: [74.8620, 31.6125],
              zoom: 15
            });

            m.on('error', (e) => {
              console.error('MapLibre map error:', e.error ? e.error.message : e);
            });

            m.on('load', () => {
              console.log('MapLibre load event fired!');
            });

            const canvas = el.querySelector('canvas');
            return {
              mapCreated: true,
              hasCanvasNow: !!canvas,
              canvasWidth: canvas ? canvas.width : 0,
              canvasHeight: canvas ? canvas.height : 0
            };
          } catch(err) {
            return { error: err.message, stack: err.stack };
          }
        })()`,
        returnByValue: true
      });
      console.log('Direct MapLibre test result:', res2.result.value);

      await new Promise(r => setTimeout(r, 2000));
      resolve();
    }
  });
}

run();
