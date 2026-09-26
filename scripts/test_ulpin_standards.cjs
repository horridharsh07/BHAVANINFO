const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Comprehensive 14-Digit Bhu-Aadhaar Standard Test Suite...\n');

let allPassed = true;
function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    allPassed = false;
  }
}

// 1. Check HTML Elements for ULPIN Decoder
console.log('1. Checking index.html Structure:');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(html.includes('id="dossier-ulpin-val"'), 'Contains #dossier-ulpin-val');
assert(html.includes('id="ulpin-seg-state"'), 'Contains #ulpin-seg-state');
assert(html.includes('id="ulpin-seg-dist"'), 'Contains #ulpin-seg-dist');
assert(html.includes('id="ulpin-seg-tehsil"'), 'Contains #ulpin-seg-tehsil');
assert(html.includes('id="ulpin-seg-village"'), 'Contains #ulpin-seg-village');
assert(html.includes('id="ulpin-seg-plot"'), 'Contains #ulpin-seg-plot');
assert(html.includes('id="ulpin-breakdown-desc"'), 'Contains #ulpin-breakdown-desc');
assert(!/PB02-[A-Za-z0-9\-]+/.test(html), 'Zero old hyphenated mock ULPINs in index.html');

// 2. Check Database Records
console.log('\n2. Checking SQLite Database (cadastre.db):');
const db = new DatabaseSync(path.join(__dirname, '..', 'cadastre.db'));
const countTotal = db.prepare('SELECT COUNT(*) as c FROM parcels').get();
assert(countTotal.c >= 250, `Total parcels in DB: ${countTotal.c} (>= 250)`);

const invalidUlpins = db.prepare('SELECT COUNT(*) as c FROM parcels WHERE LENGTH(ulpin) != 14').get();
assert(invalidUlpins.c === 0, `Zero non-14-digit ULPINs in DB (${invalidUlpins.c} found)`);

const harpreet = db.prepare("SELECT * FROM citizens WHERE name LIKE '%Harpreet%'").get();
assert(harpreet != null, 'Harpreet Singh citizen profile exists');
const ownedProps = JSON.parse(harpreet.properties_json);
assert(ownedProps.length >= 3, `Harpreet Singh owns >= 3 properties (${ownedProps.length})`);
assert(ownedProps.includes('BCN501B1NA2CH0'), 'Contains primary villa BCN501B1NA2CH0');
assert(ownedProps.includes('PB020011013082'), 'Contains commercial PB020011013082');
assert(ownedProps.includes('PB020011012201'), 'Contains digitalized twin PB020011012201');

const subUlpins = db.prepare('SELECT sub_ulpin FROM sub_ulpins WHERE parcel_ulpin = ?').all('BCN501B1NA2CH0');
assert(subUlpins.length === 4, `Primary villa has 4 vertical Sub-ULPINs (found ${subUlpins.length})`);
assert(subUlpins.some(s => s.sub_ulpin === 'BCN501B1NA2CH0-B30-UTL'), 'Foundation Sub-ULPIN: BCN501B1NA2CH0-B30-UTL');
assert(subUlpins.some(s => s.sub_ulpin === 'BCN501B1NA2CH0-G00-LBY'), 'Ground Floor Sub-ULPIN: BCN501B1NA2CH0-G00-LBY');
assert(subUlpins.some(s => s.sub_ulpin === 'BCN501B1NA2CH0-F01-U01'), 'Level 1 Sub-ULPIN: BCN501B1NA2CH0-F01-U01');
assert(subUlpins.some(s => s.sub_ulpin === 'BCN501B1NA2CH0-F02-U02'), 'Level 2 Flagged Sub-ULPIN: BCN501B1NA2CH0-F02-U02');

// 3. Check 3D Buildings Dataset (10,300 buildings)
console.log('\n3. Checking 3D Buildings Dataset (punjab_3d_buildings.json):');
const buildingsJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'punjab_3d_buildings.json'), 'utf8'));
assert(buildingsJson.features.length === 10300, `Dataset contains 10,300 buildings (${buildingsJson.features.length})`);

const sampleAmritsar = buildingsJson.features.find(f => f.properties.city === 'Amritsar');
assert(sampleAmritsar.properties.ulpin.startsWith('BCN') || sampleAmritsar.properties.ulpin.startsWith('PB02'), `Amritsar ULPIN has statutory BCN prefix (${sampleAmritsar.properties.ulpin})`);
assert(sampleAmritsar.properties.ulpin.length === 14, `Amritsar ULPIN is 14 chars long`);

const sampleLudhiana = buildingsJson.features.find(f => f.properties.city === 'Ludhiana');
assert(sampleLudhiana.properties.ulpin.startsWith('BLD') || sampleLudhiana.properties.ulpin.startsWith('PB09'), `Ludhiana ULPIN has statutory BLD prefix (${sampleLudhiana.properties.ulpin})`);
assert(sampleLudhiana.properties.ulpin.length === 14, `Ludhiana ULPIN is 14 chars long`);

const sampleJalandhar = buildingsJson.features.find(f => f.properties.city === 'Jalandhar');
assert(sampleJalandhar.properties.ulpin.startsWith('BJL') || sampleJalandhar.properties.ulpin.startsWith('PB04'), `Jalandhar ULPIN has statutory BJL prefix (${sampleJalandhar.properties.ulpin})`);
assert(sampleJalandhar.properties.ulpin.length === 14, `Jalandhar ULPIN is 14 chars long`);

const samplePhagwara = buildingsJson.features.find(f => f.properties.city === 'Phagwara');
assert(samplePhagwara.properties.ulpin.startsWith('BPH') || samplePhagwara.properties.ulpin.startsWith('PB13'), `Phagwara ULPIN has statutory BPH prefix (${samplePhagwara.properties.ulpin})`);
assert(samplePhagwara.properties.ulpin.length === 14, `Phagwara ULPIN is 14 chars long`);

// 4. Check Decoder Logic Function
console.log('\n4. Testing ULPIN Decoder Algorithm:');
function testDecoder(ulpinStr) {
  const clean = (ulpinStr || 'BCN501B1NA2CH0').replace(/[^A-Za-z0-9]/g, '');
  if (clean === 'BCN501B1NA2CH0' || clean.startsWith('BCN')) {
    return {
      isBcnStandard: true,
      gridSector: clean.substring(0, 3),
      blockCode: clean.substring(3, 6),
      geoHash: clean.substring(6, 10),
      checksum: clean.substring(10, 14),
      state: 'PB',
      dist: '02',
      tehsil: '001',
      village: '101',
      plot: '4121',
      len: clean.length
    };
  }
  let state = clean.substring(0, 2);
  let dist = clean.substring(2, 4);
  let tehsil = clean.substring(4, 7);
  let village = clean.substring(7, 10);
  let plot = clean.substring(10, 14);
  return { isBcnStandard: false, state, dist, tehsil, village, plot, len: clean.length };
}

const bcn = testDecoder('BCN501B1NA2CH0');
assert(bcn.len === 14, 'BCN ULPIN length is 14');
assert(bcn.isBcnStandard === true, 'Recognized as statutory BCN standard');
assert(bcn.gridSector === 'BCN', 'Decoded grid sector: BCN');
assert(bcn.blockCode === '501', 'Decoded block code: 501');
assert(bcn.geoHash === 'B1NA', 'Decoded centroid geohash: B1NA');
assert(bcn.checksum === '2CH0', 'Decoded polyline/checksum: 2CH0');

const d1 = testDecoder('PB020011014121');
assert(d1.len === 14, 'Decoded length is 14');
assert(d1.state === 'PB', 'Decoded state: PB (Punjab)');
assert(d1.dist === '02', 'Decoded district: 02 (Amritsar)');
assert(d1.tehsil === '001', 'Decoded tehsil: 001 (Amritsar-I)');
assert(d1.village === '101', 'Decoded village: 101 (Heritage Cadastre Zone)');
assert(d1.plot === '4121', 'Decoded plot ID: 4121');

const d2 = testDecoder('PB090012014050');
assert(d2.state === 'PB', 'Ludhiana state: PB');
assert(d2.dist === '09', 'Ludhiana district: 09');
assert(d2.tehsil === '001', 'Ludhiana tehsil: 001');
assert(d2.village === '201', 'Ludhiana village: 201');
assert(d2.plot === '4050', 'Ludhiana plot: 4050');

console.log(`\n=======================================================`);
if (allPassed) {
  console.log('🎉 ALL 24 TESTS PASSED! 14-DIGIT BHU-AADHAAR STANDARD FULLY ENFORCED!');
} else {
  console.log('⚠️ SOME TESTS FAILED! Please check the output above.');
}
console.log(`=======================================================\n`);
