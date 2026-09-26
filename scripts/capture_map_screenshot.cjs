const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9341;
  const userDataDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\6d95dcb3-4136-43af-bbf3-966d4eb09f03\\scratch\\edge_screenshots_map_profile';
  
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
          await captureMap(pageTab.webSocketDebuggerUrl);
        }
        break;
      }
    } catch (e) {}
  }

  try { edge.kill('SIGKILL'); } catch (e) {}
  process.exit(0);
}

function captureMap(wsUrl) {
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
            }
          } catch (e) {}
        }
      }
    });

    async function onHandshake() {
      await sendCommand('Page.enable');
      await sendCommand('Runtime.enable');
      await new Promise(r => setTimeout(r, 1200));

      const artifactDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\6d95dcb3-4136-43af-bbf3-966d4eb09f03';

      // Login first
      await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          window.app.enterPortalDirectly();
        })()`
      });
      await new Promise(r => setTimeout(r, 600));

      // Now switch to Map
      await sendCommand('Runtime.evaluate', {
        expression: `(function() {
          window.app.switchView('map');
        })()`
      });
      await new Promise(r => setTimeout(r, 3000));

      const mapShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
      if (mapShot && mapShot.data) {
        fs.writeFileSync(path.join(artifactDir, 'screenshot_map_fixed.png'), Buffer.from(mapShot.data, 'base64'));
        console.log('📸 Saved screenshot_map_fixed.png');
      }

      resolve();
    }
  });
}

run();
