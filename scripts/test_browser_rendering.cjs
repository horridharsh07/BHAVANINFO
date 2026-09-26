const { spawn } = require('child_process');
const net = require('net');

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9335;
  const userDataDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\6d95dcb3-4136-43af-bbf3-966d4eb09f03\\scratch\\edge_debug_network';
  
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

  let connected = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        connected = true;
        const tabs = await res.json();
        const pageTab = tabs.find(t => t.type === 'page');
        if (pageTab) {
          await interactWithTab(pageTab.webSocketDebuggerUrl);
        }
        break;
      }
    } catch (e) {}
  }

  try { edge.kill('SIGKILL'); } catch (e) {}
  process.exit(0);
}

function interactWithTab(wsUrl) {
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
      return new Promise((res) => {
        callbacks.set(id, res);
      });
    }

    client.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.includes(Buffer.from('\r\n\r\n'))) {
        const idx = buffer.indexOf(Buffer.from('\r\n\r\n'));
        const headerStr = buffer.slice(0, idx).toString();
        if (headerStr.startsWith('HTTP/1.1 101')) {
          buffer = buffer.slice(idx + 4);
          onHandshakeDone();
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
            } else if (data.method === 'Network.loadingFailed') {
              console.error(`[Network Failed] URL: ${data.params.requestId} error: ${data.params.errorText}`);
            } else if (data.method === 'Network.responseReceived') {
              if (data.params.response.status >= 400) {
                console.warn(`[HTTP ${data.params.response.status}] ${data.params.response.url}`);
              }
            }
          } catch (e) {}
        }
      }
    });

    async function onHandshakeDone() {
      await sendCommand('Network.enable');
      await sendCommand('Console.enable');
      await sendCommand('Runtime.enable');

      await new Promise(r => setTimeout(r, 1000));

      console.log('=== Switching to MAP view ===');
      const res = await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          window.app.loginUser();
          window.app.switchView('map');
          const mapEl = document.getElementById('cadastre-map');
          const vp = document.querySelector('.app-viewport');
          const mapPanel = document.getElementById('view-map');
          const container = document.querySelector('.map-view-container');
          return {
            windowInner: { w: window.innerWidth, h: window.innerHeight },
            viewportRect: vp ? { w: vp.clientWidth, h: vp.clientHeight } : null,
            mapPanelRect: mapPanel ? { w: mapPanel.clientWidth, h: mapPanel.clientHeight } : null,
            containerRect: container ? { w: container.clientWidth, h: container.clientHeight } : null,
            mapElRect: mapEl ? { w: mapEl.clientWidth, h: mapEl.clientHeight } : null,
            mapLoaded: window.app.map2d ? window.app.map2d.isLoaded : false
          };
        })()`,
        returnByValue: true
      });
      console.log('Map View Dimensions:', res.result.value);

      // Wait 3 seconds to see if map loads
      await new Promise(r => setTimeout(r, 3000));

      const res2 = await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          const map = window.app.map2d ? window.app.map2d.map : null;
          const mapEl = document.getElementById('cadastre-map');
          const canvas = mapEl ? mapEl.querySelector('canvas') : null;
          return {
            mapLoaded: window.app.map2d ? window.app.map2d.isLoaded : false,
            mapStyleLoaded: map ? map.isStyleLoaded() : false,
            hasCanvas: !!canvas,
            canvasRect: canvas ? { w: canvas.clientWidth, h: canvas.clientHeight, wAttr: canvas.width, hAttr: canvas.height } : null,
            layers: map ? map.getStyle().layers.map(l => ({ id: l.id, type: l.type, visibility: l.layout ? l.layout.visibility : 'visible' })) : null
          };
        })()`,
        returnByValue: true
      });
      console.log('Map Status after 3s:', res2.result.value);

      console.log('=== Switching to TWIN view ===');
      const res3 = await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          window.app.switchView('twin');
          const twinPanel = document.getElementById('view-twin');
          const wsContainer = document.querySelector('.twin-workspace-container');
          const sidebar = document.querySelector('.twin-dossier-sidebar');
          const canvasContainer = document.querySelector('.twin-canvas-container');
          const twinEl = document.getElementById('twin-viewport');
          const canvas = twinEl ? twinEl.querySelector('canvas') : null;
          return {
            twinPanelRect: twinPanel ? { w: twinPanel.clientWidth, h: twinPanel.clientHeight } : null,
            wsContainerRect: wsContainer ? { w: wsContainer.clientWidth, h: wsContainer.clientHeight } : null,
            sidebarRect: sidebar ? { w: sidebar.clientWidth, h: sidebar.clientHeight } : null,
            canvasContainerRect: canvasContainer ? { w: canvasContainer.clientWidth, h: canvasContainer.clientHeight } : null,
            twinElRect: twinEl ? { w: twinEl.clientWidth, h: twinEl.clientHeight } : null,
            canvasRect: canvas ? { w: canvas.clientWidth, h: canvas.clientHeight, wAttr: canvas.width, hAttr: canvas.height } : null
          };
        })()`,
        returnByValue: true
      });
      console.log('Twin View Dimensions:', res3.result.value);

      resolve();
    }
  });
}

run();
