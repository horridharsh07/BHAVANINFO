const http = require('http');
const assert = require('assert');

console.log('🧪 Running End-to-End Registration & Payment Settlement Test...\n');

const testPayload = {
  owner: 'Penna Peruru Thanuj',
  survey_no: 'Khasra No. 882/4, Kot Atma Singh',
  khata: 'KH-2026/912',
  total_floors: 2,
  declared_floors: 2,
  has_basement: true,
  land_class: 'residential',
  area_sqft: 3465,
  coordinates: [
    [74.8620, 31.6125],
    [74.8626, 31.6125],
    [74.8626, 31.6131],
    [74.8620, 31.6131],
    [74.8620, 31.6125]
  ],
  challan_amount: 1250,
  state: 'Punjab',
  district: 'Amritsar',
  mandal: 'Amritsar-I',
  payment_ref: `UPI/2026/${Math.floor(10000000 + Math.random() * 90000000)}`
};

const postData = JSON.stringify(testPayload);

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/parcels/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${body}`);
      const data = JSON.parse(body);
      console.log('  ✅ PASS: Server responded with HTTP 201 Created');
      
      assert.strictEqual(data.success, true);
      console.log('  ✅ PASS: Registration returned success: true');

      assert.ok(data.assigned_ulpin, 'Expected assigned_ulpin in response');
      assert.strictEqual(data.assigned_ulpin.length, 14, `Expected 14-digit ULPIN, got ${data.assigned_ulpin}`);
      console.log(`  ✅ PASS: Assigned statutory 14-digit ULPIN: ${data.assigned_ulpin}`);

      assert.strictEqual(data.status, 'DRONE_DISPATCHED');
      console.log('  ✅ PASS: Parcel status set to DRONE_DISPATCHED');

      assert.strictEqual(data.challan_amount, 1250);
      console.log('  ✅ PASS: Challan amount recorded: ₹1,250.00');

      assert.ok(data.challan_paid.includes('Bharatkosh Gateway'));
      console.log(`  ✅ PASS: Official challan receipt string: ${data.challan_paid}`);

      assert.strictEqual(data.parcel.payment_ref, testPayload.payment_ref);
      console.log(`  ✅ PASS: Parcel returned with payment reference: ${data.parcel.payment_ref}`);

      // Verify in parcels list
      http.get('http://localhost:3000/api/parcels', (getRes) => {
        let getBody = '';
        getRes.on('data', c => getBody += c);
        getRes.on('end', () => {
          const list = JSON.parse(getBody);
          const found = list.data.find(p => p.ulpin === data.assigned_ulpin);
          assert.ok(found, 'Newly registered parcel must exist in SQLite database');
          assert.strictEqual(found.owner, 'Penna Peruru Thanuj');
          assert.strictEqual(found.tax_amount, 1250);
          assert.strictEqual(found.tax_status, 'PAID');
          console.log(`  ✅ PASS: Verified in SQLite database with settled tax/challan amount: ₹${found.tax_amount}`);
          console.log('\n🎉 End-to-End Registration & UPI Settlement Verified Successfully!\n');
          process.exit(0);
        });
      });

    } catch (e) {
      console.error('❌ Assertion failed:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
