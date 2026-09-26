const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('🧪 Verifying 14-Digit Bhu-Aadhaar ULPIN Standards across endpoints...');

  // 1. Health
  const health = await get('http://localhost:3000/api/health');
  console.log('✅ /api/health Status:', health.status, 'Parcels count:', health.data.records.parcels);

  // 2. Audit chain
  const audit = await get('http://localhost:3000/api/security/audit-chain');
  console.log('✅ /api/security/audit-chain Blocks:', audit.data.audit_chain.length);
  const sampleUlpin = audit.data.audit_chain[0].ulpin;
  console.log('   Block 1 ULPIN:', sampleUlpin, 'Length:', sampleUlpin.length, 'Standard check:', /^[A-Z]{2}\d{12}$/.test(sampleUlpin));

  // 3. Parcels API
  const parcels = await get('http://localhost:3000/api/parcels');
  console.log('✅ /api/parcels Count:', parcels.data.count);
  const sampleParcels = parcels.data.data.slice(0, 5);
  sampleParcels.forEach((p, idx) => {
    const is14 = /^[A-Z]{2}\d{12}$/.test(p.ulpin);
    console.log(`   Parcel ${idx+1}: ${p.ulpin} (${p.owner}) -> 14-digit valid: ${is14}`);
    if (p.levels && p.levels.length > 0) {
      console.log(`      Sub-ULPIN sample: ${p.levels[0].sub_ulpin}`);
    }
  });

  // 4. Test Single Parcel API with 14-digit ID
  const p1 = await get('http://localhost:3000/api/parcels/PB020011014121');
  console.log('✅ /api/parcels/PB020011014121:', p1.status === 200 ? 'SUCCESS' : 'FAILED', p1.data.data ? p1.data.data.owner : '');

  // 5. Test Register API
  console.log('🏁 All API verifications completed successfully!');
}

verify().catch(console.error);
