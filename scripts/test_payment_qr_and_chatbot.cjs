const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Running Comprehensive Payment QR & AI Chatbot Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTests() {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/gov-theme.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

  // Test 1: DOM Elements for Bharatkosh UPI QR Payment
  it('index.html contains #modal-upi-payment', () => {
    assert.ok(html.includes('id="modal-upi-payment"'));
  });

  it('index.html contains #upi-generating-state with animated loader', () => {
    assert.ok(html.includes('id="upi-generating-state"'));
    assert.ok(html.includes('class="upi-spinner"'));
  });

  it('index.html contains #upi-display-state with authentic QR image', () => {
    assert.ok(html.includes('id="upi-display-state"'));
    assert.ok(html.includes('id="upi-qr-image"'));
    assert.ok(html.includes('src="/data/upi_payment_qr.png"'));
  });

  it('index.html contains fixed challan amount display', () => {
    assert.ok(html.includes('id="upi-modal-amount-display"'));
    assert.ok(html.includes('id="btn-upi-pay-amount"'));
  });

  it('index.html contains UPI App badges (Google Pay, PhonePe, Paytm, BHIM)', () => {
    assert.ok(html.includes('Google Pay'));
    assert.ok(html.includes('PhonePe'));
    assert.ok(html.includes('Paytm'));
    assert.ok(html.includes('BHIM UPI'));
  });

  it('index.html contains Instant Scan & Pay simulation trigger', () => {
    assert.ok(html.includes('id="btn-simulate-upi-scan"'));
    assert.ok(html.includes('simulateUpiAppScan'));
  });

  it('index.html contains UTR Verification trigger', () => {
    assert.ok(html.includes('id="btn-verify-upi-utr"'));
    assert.ok(html.includes('confirmUpiPayment'));
  });

  it('index.html contains #upi-success-state', () => {
    assert.ok(html.includes('id="upi-success-state"'));
    assert.ok(html.includes('id="upi-success-amount"'));
    assert.ok(html.includes('id="upi-success-utr"'));
  });

  // Test 2: AI Chatbot DOM Elements
  it('index.html contains floating action button (FAB) #btn-open-ai-assistant', () => {
    assert.ok(html.includes('id="btn-open-ai-assistant"'));
    assert.ok(html.includes('class="ai-assistant-fab"'));
  });

  it('index.html contains AI Assistant Drawer #ai-assistant-drawer', () => {
    assert.ok(html.includes('id="ai-assistant-drawer"'));
    assert.ok(html.includes('id="ai-chat-messages"'));
    assert.ok(html.includes('id="ai-chat-form"'));
    assert.ok(html.includes('id="ai-chat-input"'));
    assert.ok(html.includes('id="btn-close-ai-assistant"'));
  });

  it('index.html includes landing side-panel AI Assistant trigger', () => {
    assert.ok(html.includes('id="side-menu-ai-btn"'));
  });

  it('index.html contains statutory quick prompts (Section 187, Jamabandi RoR, 3D Sub-ULPIN)', () => {
    assert.ok(html.includes('Section 187 Demolition'));
    assert.ok(html.includes('Jamabandi Sec 31'));
    assert.ok(html.includes('3D Sub-ULPIN'));
  });

  // Test 3: CSS Styles
  it('CSS defines .ai-assistant-fab with elevated z-index (99998)', () => {
    assert.ok(css.includes('.ai-assistant-fab'));
    assert.ok(css.includes('z-index: 99998;'));
  });

  it('CSS defines .ai-assistant-panel with top-level z-index (99999)', () => {
    assert.ok(css.includes('.ai-assistant-panel'));
    assert.ok(css.includes('z-index: 99999;'));
  });

  it('CSS defines .upi-payment-card and .upi-spinner animations', () => {
    assert.ok(css.includes('.upi-payment-card'));
    assert.ok(css.includes('.upi-spinner'));
  });

  // Test 4: app.js Controller Logic
  it('app.js defines openUpiPaymentModal, closeUpiPaymentModal, simulateUpiAppScan', () => {
    assert.ok(appJs.includes('openUpiPaymentModal('));
    assert.ok(appJs.includes('closeUpiPaymentModal()'));
    assert.ok(appJs.includes('simulateUpiAppScan()'));
    assert.ok(appJs.includes('confirmUpiPayment('));
  });

  it('app.js defines openAiAssistant and setupAiAssistant', () => {
    assert.ok(appJs.includes('openAiAssistant()'));
    assert.ok(appJs.includes('setupAiAssistant()'));
  });

  // Test 5: HTTP Endpoints
  await new Promise((resolve) => {
    http.get('http://localhost:3000/data/upi_payment_qr.png', (res) => {
      it('GET /data/upi_payment_qr.png returns HTTP 200 with valid image length', () => {
        assert.strictEqual(res.statusCode, 200);
        const len = parseInt(res.headers['content-length'] || '0', 10);
        assert.ok(len > 10000, `Expected > 10000 bytes, got ${len}`);
      });
      resolve();
    }).on('error', (e) => {
      it('GET /data/upi_payment_qr.png server reachable', () => {
        assert.fail(`Server unreachable: ${e.message}`);
      });
      resolve();
    });
  });

  // Test 6: AI Cadastre Query HTTP API
  await new Promise((resolve) => {
    const postData = JSON.stringify({
      query: 'What is Section 187 notice period?',
      state: 'Punjab',
      district: 'Amritsar'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/ai/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        it('POST /api/ai/query returns 200 with statutory answer and citations', () => {
          assert.strictEqual(res.statusCode, 200);
          const data = JSON.parse(body);
          assert.strictEqual(data.success, true);
          assert.ok(data.answer && data.answer.length > 20);
          assert.ok(Array.isArray(data.citations) && data.citations.length > 0);
        });
        resolve();
      });
    });

    req.on('error', (e) => {
      it('POST /api/ai/query reachable', () => {
        assert.fail(`AI query failed: ${e.message}`);
      });
      resolve();
    });

    req.write(postData);
    req.end();
  });

  console.log(`\nResults: ${passedTests} Passed, ${totalTests - passedTests} Failed\n`);
  if (totalTests - passedTests > 0) process.exit(1);
}

runAsyncTests().catch(e => {
  console.error('Test suite uncaught error:', e);
  process.exit(1);
});
