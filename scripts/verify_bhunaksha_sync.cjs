const http = require('http');
const fs = require('fs');
const path = require('path');

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

let allPassed = true;
function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    allPassed = false;
  }
}

async function verify() {
  console.log('🧪 Running Comprehensive BhuNaksha Sync & Verification Test Suite...\n');

  // 1. API Verification
  console.log('1. Verifying /api/parcels/:ulpin BhuNaksha Payload:');
  const pRes = await get('http://localhost:3000/api/parcels/BCN501B1NA2CH0');
  assert(pRes.status === 200, 'HTTP 200 for BCN501B1NA2CH0');
  const bhu = pRes.data.data.bhunaksha;
  assert(bhu != null, 'bhunaksha object present in API response');
  assert(bhu.state === 'Punjab', `State is Punjab (${bhu.state})`);
  assert(bhu.district === 'Amritsar', `District is Amritsar (${bhu.district})`);
  assert(bhu.tehsil.includes('Amritsar-I'), `Tehsil contains Amritsar-I (${bhu.tehsil})`);
  assert(bhu.village.includes('Kot Atma Singh'), `Village is Kot Atma Singh (${bhu.village})`);
  assert(bhu.hadbast_no === '101', `Hadbast No is 101 (${bhu.hadbastNo || bhu.hadbast_no})`);
  assert(bhu.khasra_no === '412/1', `Khasra No is 412/1 (${bhu.khasra_no})`);
  assert(bhu.khewat_no != null, `Khewat No is present (${bhu.khewat_no})`);
  assert(bhu.khatouni_no != null, `Khatouni No is present (${bhu.khatouni_no})`);
  assert(bhu.kanal_marla.includes('Kanal'), `Area in Kanal-Marla format: ${bhu.kanal_marla}`);
  assert(bhu.verification_portal === 'https://jamabandi.punjab.gov.in/', `Portal URL: ${bhu.verification_portal}`);

  // Test alias PB020011014121
  const pAlias = await get('http://localhost:3000/api/parcels/PB020011014121');
  assert(pAlias.status === 200, 'HTTP 200 for legacy alias PB020011014121');

  // 2. HTML Verification
  console.log('\n2. Verifying index.html BhuNaksha Components:');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(html.includes('id="modal-bhunaksha-fard"'), 'Contains #modal-bhunaksha-fard modal');
  assert(html.includes('id="btn-copy-bhunaksha"'), 'Contains #btn-copy-bhunaksha button');
  assert(html.includes('https://jamabandi.punjab.gov.in/'), 'Contains live link to jamabandi.punjab.gov.in');
  assert(html.includes('id="bhunaksha-dist-tehsil"'), 'Contains #bhunaksha-dist-tehsil');
  assert(html.includes('id="bhunaksha-village-hadbast"'), 'Contains #bhunaksha-village-hadbast');
  assert(html.includes('id="bhunaksha-area-kanal"'), 'Contains #bhunaksha-area-kanal');
  assert(html.includes('id="bhunaksha-land-type"'), 'Contains #bhunaksha-land-type');
  assert(html.includes('id="fard-tbl-khasra"'), 'Contains #fard-tbl-khasra');
  assert(html.includes('id="fard-tbl-area"'), 'Contains #fard-tbl-area');

  // 3. Buildings Dataset Verification
  console.log('\n3. Verifying punjab_3d_buildings.json Dataset (10,300 buildings):');
  const bData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'punjab_3d_buildings.json'), 'utf8'));
  assert(bData.features.length === 10300, `Contains 10,300 buildings (${bData.features.length})`);
  
  const sample1 = bData.features[0].properties;
  assert(sample1.hadbast_no === '101', `Feature 0 Hadbast No: ${sample1.hadbast_no}`);
  assert(sample1.khasra_no === '412/1', `Feature 0 Khasra No: ${sample1.khasra_no}`);
  assert(sample1.kanal_marla.includes('Kanal'), `Feature 0 Kanal-Marla: ${sample1.kanal_marla}`);
  assert(sample1.verification_portal === 'https://jamabandi.punjab.gov.in/', `Feature 0 verification portal verified`);

  const sampleLudhiana = bData.features.find(f => f.properties.city === 'Ludhiana');
  assert(sampleLudhiana.properties.hadbast_no === '201', `Ludhiana Hadbast No: ${sampleLudhiana.properties.hadbast_no}`);
  assert(sampleLudhiana.properties.khasra_no != null, `Ludhiana Khasra No: ${sampleLudhiana.properties.khasra_no}`);

  const samplePhagwara = bData.features.find(f => f.properties.city === 'Phagwara');
  assert(samplePhagwara.properties.hadbast_no === '401', `Phagwara Hadbast No: ${samplePhagwara.properties.hadbast_no}`);
  assert(samplePhagwara.properties.khasra_no != null, `Phagwara Khasra No: ${samplePhagwara.properties.khasra_no}`);

  console.log(`\n=======================================================`);
  if (allPassed) {
    console.log('🎉 ALL BHUNAKSHA SYNC & VERIFICATION TESTS PASSED (100%)!');
  } else {
    console.error('⚠️ SOME TESTS FAILED! Please check the output above.');
  }
  console.log(`=======================================================\n`);
}

verify().catch(console.error);
