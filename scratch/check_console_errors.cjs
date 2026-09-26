const { spawn } = require('child_process');
const net = require('net');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9345;
  const userDataDir = 'C:\\Users\\thanu\\.gemini\\antigravity-ide\\brain\\89a3fe7e-3326-40fc-bf54-4078e1386175\\scratch\\edge_debug_profile';

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
    console.error("Could not connect to Edge debugger");
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
        sendCommand('Log.enable');
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
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log(`[CONSOLE ${msg.params.type.toUpperCase()}]`, ...msg.params.args.map(a => a.value || a.description || JSON.stringify(a)));
        } else if (msg.method === 'Runtime.exceptionThrown') {
          console.error(`[EXCEPTION]`, msg.params.exceptionDetails);
        } else if (msg.method === 'Log.entryAdded') {
          console.log(`[LOG ${msg.params.entry.level}]`, msg.params.entry.text);
        }
      } catch (e) {}
    }
  });

  // Wait 6 seconds to capture logs
  await new Promise(r => setTimeout(r, 6000));
  try { edge.kill('SIGKILL'); } catch(e) {}
  process.exit(0);
}

main();
