const { spawn } = require('child_process');
const net = require('net');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9346;
  const userDataDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\89a3fe7e-3326-40fc-bf54-4078e1386175\\scratch\\edge_debug_map';

  const edge = spawn(edgePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--window-size=1600,900',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    'http://localhost:3000/?#section-rules'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const tabs = await res.json();
        const pageTab = tabs.find(t => t.type === 'page');
        if (pageTab) {
          wsUrl = pageTab.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error("Could not connect");
    edge.kill('SIGKILL');
    process.exit(1);
  }

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
    return new Promise(resolve => callbacks.set(id, resolve));
  }

  client.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.includes(Buffer.from('\r\n\r\n'))) {
      const idx = buffer.indexOf(Buffer.from('\r\n\r\n'));
      const headerStr = buffer.slice(0, idx).toString();
      if (headerStr.startsWith('HTTP/1.1 101')) {
        buffer = buffer.slice(idx + 4);
        sendCommand('Console.enable');
        sendCommand('Runtime.enable');
        sendCommand('Network.enable');
      }
    }

    while (buffer.length >= 2) {
      const b1 = buffer[0];
      const b2 = buffer[1];
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
      const data = buffer.slice(offset, offset + payloadLen);
      buffer = buffer.slice(offset + payloadLen);

      try {
        const msg = JSON.parse(data.toString('utf-8'));
        if (callbacks.has(msg.id)) {
          callbacks.get(msg.id)(msg.result);
          callbacks.delete(msg.id);
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log(`[CONSOLE ${msg.params.type}]`, ...msg.params.args.map(a => a.value !== undefined ? a.value : a.description));
        } else if (msg.method === 'Runtime.exceptionThrown') {
          console.error(`[EXCEPTION]`, msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
        } else if (msg.method === 'Network.requestWillBeSent') {
          // console.log(`[REQ] ${msg.params.request.url}`);
        } else if (msg.method === 'Network.loadingFailed') {
          console.log(`[NET FAIL] ${msg.params.errorText}: ${msg.params.type}`);
        } else if (msg.method === 'Network.responseReceived') {
          if (msg.params.response.status >= 400) {
            console.log(`[NET HTTP ${msg.params.response.status}] ${msg.params.response.url}`);
          }
        }
      } catch (e) {}
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // Now switch to 'map' view
  console.log("Switching to 'map' view...");
  const evalRes = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      if (!window.app) return "window.app not found";
      window.app.switchView('map');
      return "switched to map";
    })()`,
    returnByValue: true
  });
  console.log("Switch result:", evalRes);

  await new Promise(r => setTimeout(r, 3000));

  // Check map state
  const mapState = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      if (!window.app || !window.app.map2d) return { error: "no map2d" };
      const m = window.app.map2d.map;
      if (!m) return { error: "no map instance" };
      return {
        loaded: m.loaded(),
        styleLoaded: m.isStyleLoaded(),
        zoom: m.getZoom(),
        center: m.getCenter(),
        pitch: m.getPitch(),
        bearing: m.getBearing(),
        bounds: m.getBounds(),
        layers: m.getStyle()?.layers?.map(l => ({ id: l.id, type: l.type, visibility: l.layout?.visibility })),
        sources: Object.keys(m.getStyle()?.sources || {}),
        containerRect: {
          w: document.getElementById('cadastre-map')?.clientWidth,
          h: document.getElementById('cadastre-map')?.clientHeight
        }
      };
    })()`,
    returnByValue: true
  });
  console.log("Map state:", JSON.stringify(mapState, null, 2));

  // Check twin state
  console.log("Switching to 'twin' view...");
  await sendCommand('Runtime.evaluate', {
    expression: `window.app.switchView('twin')`,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 2000));

  const twinState = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      if (!window.app || !window.app.twin3d) return { error: "no twin3d" };
      const t = window.app.twin3d;
      return {
        hasScene: !!t.scene,
        hasRenderer: !!t.renderer,
        childrenCount: t.scene ? t.scene.children.length : 0,
        children: t.scene ? t.scene.children.map(c => ({ type: c.type, name: c.name })) : [],
        cameraPos: t.camera ? t.camera.position : null,
        controlsTarget: t.controls ? t.controls.target : null,
        activeParcel: window.app.activeParcel ? {
          bhu_aadhaar: window.app.activeParcel.bhu_aadhaar,
          title: window.app.activeParcel.title,
          levelsCount: window.app.activeParcel.levels?.length
        } : null,
        containerRect: {
          w: document.getElementById('twin-viewport')?.clientWidth,
          h: document.getElementById('twin-viewport')?.clientHeight
        }
      };
    })()`,
    returnByValue: true
  });
  console.log("Twin state:", JSON.stringify(twinState, null, 2));

  try { edge.kill('SIGKILL'); } catch(e) {}
  process.exit(0);
}

main();
