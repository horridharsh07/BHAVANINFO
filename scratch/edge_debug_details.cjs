const { spawn } = require('child_process');
const net = require('net');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9347;
  const userDataDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\89a3fe7e-3326-40fc-bf54-4078e1386175\\scratch\\edge_debug_details';

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
    '--ignore-certificate-errors', // note: testing with certificate errors ignored vs present
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
  const requests = new Map();

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
          requests.set(msg.params.requestId, msg.params.request.url);
        } else if (msg.method === 'Network.loadingFailed') {
          const u = requests.get(msg.params.requestId) || 'unknown';
          console.log(`[NET FAILED: ${msg.params.errorText}] ${u}`);
        } else if (msg.method === 'Network.responseReceived') {
          const u = msg.params.response.url;
          if (msg.params.response.status >= 400) {
            console.log(`[HTTP ${msg.params.response.status}] ${u}`);
          }
        }
      } catch (e) {}
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // Let's check what user clicks when clicking "3D Satellite City Map (All Buildings in 3D)"
  console.log("Simulating click on 3D Satellite City Map tab...");
  await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const navItem = document.querySelector('.nav-item[data-view="map"]');
      if (navItem) navItem.click();
      else if (window.app) window.app.switchView('map');
    })()`,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 3000));

  const checkMap = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const container = document.getElementById('cadastre-map');
      const viewMap = document.getElementById('view-map');
      const mapObj = window.app?.map2d?.map;
      return {
        viewMapStyle: viewMap ? { display: viewMap.style.display, class: viewMap.className, offsetW: viewMap.offsetWidth, offsetH: viewMap.offsetHeight } : null,
        containerStyle: container ? { offsetW: container.offsetWidth, offsetH: container.offsetHeight, clientW: container.clientWidth, clientH: container.clientHeight, display: getComputedStyle(container).display } : null,
        mapLoaded: mapObj ? mapObj.loaded() : false,
        mapCanvas: container ? !!container.querySelector('canvas') : false,
        canvasW: container?.querySelector('canvas')?.width,
        canvasH: container?.querySelector('canvas')?.height,
        zoom: mapObj ? mapObj.getZoom() : null,
        center: mapObj ? mapObj.getCenter() : null
      };
    })()`,
    returnByValue: true
  });
  console.log("CheckMap:", JSON.stringify(checkMap, null, 2));

  // Also check Twin 3D view
  console.log("Simulating click on 3D Digital Twin Inspector tab...");
  await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const navItem = document.querySelector('.nav-item[data-view="twin"]');
      if (navItem) navItem.click();
      else if (window.app) window.app.switchView('twin');
    })()`,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 3000));

  const checkTwin = await sendCommand('Runtime.evaluate', {
    expression: `(function() {
      const t = window.app?.twin3d;
      const container = document.getElementById('twin-viewport');
      return {
        activeParcel: window.app?.activeParcel?.title,
        hasBuildingGroup: !!t?.buildingGroup,
        buildingGroupChildren: t?.buildingGroup?.children?.length,
        buildingGroupPos: t?.buildingGroup?.position,
        cameraPos: t?.camera?.position,
        cameraNear: t?.camera?.near,
        cameraFar: t?.camera?.far,
        controlsTarget: t?.controls?.target,
        canvas: !!container?.querySelector('canvas'),
        canvasW: container?.querySelector('canvas')?.width,
        canvasH: container?.querySelector('canvas')?.height
      };
    })()`,
    returnByValue: true
  });
  console.log("CheckTwin:", JSON.stringify(checkTwin, null, 2));

  try { edge.kill('SIGKILL'); } catch(e) {}
  process.exit(0);
}

main();
