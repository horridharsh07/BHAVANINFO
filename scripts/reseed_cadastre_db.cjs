const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, '..', 'cadastre.db');
const db = new DatabaseSync(dbPath);

console.log('🔄 Re-seeding cadastre.db with official 14-digit Bhu-Aadhaar standard...');

// 1. Drop and recreate or clean tables
db.exec(`
  DELETE FROM sub_ulpins;
  DELETE FROM cadastre_history;
  DELETE FROM parcels;
  DELETE FROM citizens;
`);

// 2. Re-insert citizens with 14-digit owned ULPINs
const insertCitizen = db.prepare(`
  INSERT OR REPLACE INTO citizens 
  (aadhaar_masked, name, father_name, mobile, email, address, role, user_id, ekyc_verified, properties_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertCitizen.run(
  'XXXX-XXXX-8921',
  'Sardar Harpreet Singh',
  'Late S. Balwant Singh',
  '+91 98765-XXXXX',
  'harpreet.singh.asr@nic.in',
  'H.No. 412, Heritage Zone, Amritsar - 143001, Punjab',
  'CITIZEN',
  'PB-ASR-CITIZEN-0921',
  1,
  JSON.stringify([
    'BCN501B1NA2CH0', 'BCN501C2KB4M10', 'BCN501D3LC5N20', 'BCN501F5NE7Q40'
  ])
);

insertCitizen.run(
  'XXXX-XXXX-1044',
  'Shri Vikramjit Singh, PCS',
  'Shri K.S. Singh',
  '+91 94172-XXXXX',
  'vikram.pcs.asr@punjab.gov.in',
  'District Administrative Complex, Court Road, Amritsar',
  'AUTHORITY_HEAD',
  'GOVT-REV-OFFICER-02',
  1,
  JSON.stringify([])
);

// 3. Prepare parcel insertion
const insertParcel = db.prepare(`
  INSERT OR REPLACE INTO parcels (
    ulpin, id, survey_no, khata, village, tehsil, district,
    owner, aadhaar, status, total_floors, declared_floors,
    has_anomaly, anomaly_desc, tax_amount, tax_status,
    coordinates_json, centroid_lat, centroid_lng, registration_date, drone_scan_date
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertLevel = db.prepare(`
  INSERT OR REPLACE INTO sub_ulpins (
    sub_ulpin, parcel_ulpin, level_code, name,
    is_subterranean, depth_feet, height_m, carpet_area_sqft,
    owner, tax_status, is_flagged, utilities_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertHistory = db.prepare(`
  INSERT OR REPLACE INTO cadastre_history (
    parcel_ulpin, year, badge, event_desc, registered_owner,
    khata, tax, scan_date, has_anomaly, active_levels_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const utilities = [
  { type: 'High Voltage Electric Conduits', color: '#ff3344', status: 'ACTIVE', meter: 'PSPCL-HT-449' },
  { type: 'Municipal Water Line (Inlet)', color: '#00bbff', status: 'ACTIVE', meter: 'MCA-W-8812' },
  { type: 'Main Sewerage Outflow', color: '#cc7722', status: 'ACTIVE', meter: 'MCA-SEW-091' },
  { type: 'Piped Natural Gas (PNG)', color: '#eab308', status: 'ACTIVE', meter: 'MCA-GAS-112' },
  { type: 'Optical Fiber Telecom Trunk', color: '#10b981', status: 'ACTIVE', meter: 'BSNL-OFC-789' }
];

// Parcel 1: BCN501B1NA2CH0 (Statutory 14-character alphanumeric ULPIN standard) & PB020011014121 (alias)
const ulpin1 = 'BCN501B1NA2CH0';
const legacyUlpin1 = 'PB020011014121';
const coords1 = [
  [74.8597738, 31.6105219],
  [74.8596972, 31.6103837],
  [74.8600688, 31.6102341],
  [74.8600667, 31.6102304],
  [74.8601983, 31.6101775],
  [74.860277, 31.6103194],
  [74.8597738, 31.6105219]
];

// Parcel 1: BCN501B1NA2CH0 (Statutory 14-character alphanumeric ULPIN standard)
insertParcel.run(
  ulpin1, 'parcel-1', 'Khasra No. 412/1', 'KH-2024/782',
  'Kot Atma Singh / Heritage Cadastre Zone', 'Amritsar-I (Urban)', 'Amritsar, Punjab',
  'Sardar Harpreet Singh', 'XXXX-XXXX-8921', 'FLAGGED_VIOLATION', 3, 2,
  1, 'Declared G+1; Autonomous 3D LiDAR SLAM detected unauthorized Level 3 extension (+3.2m height excess). Statutory 24h notice active.',
  14200, 'PAID', JSON.stringify(coords1), 31.610341, 74.859979, '18-Aug-2021', '04-Feb-2026'
);

insertLevel.run(
  `${ulpin1}-B30-UTL`, ulpin1, 'B30', 'Subterranean Foundation (-30 ft / -9.14 m)',
  1, -30.0, 9.14, 1200, 'Government / Municipal Corporation of Amritsar (MCA)', 'PAID', 0, JSON.stringify(utilities)
);
insertLevel.run(
  `${ulpin1}-G00-LBY`, ulpin1, 'G00', 'Ground Floor (Lobby & Stilt Parking)',
  0, 0, 3.2, 1150, 'Sardar Harpreet Singh', 'PAID', 0, '[]'
);
insertLevel.run(
  `${ulpin1}-F01-U01`, ulpin1, 'F01', 'Level 1 - Residential Unit',
  0, 0, 3.0, 1190, 'Sardar Harpreet Singh', 'PAID', 0, '[]'
);
insertLevel.run(
  `${ulpin1}-F02-U02`, ulpin1, 'F02', 'Level 2 - Unauthorized Terrace Suite',
  0, 0, 3.2, 1150, 'Sardar Harpreet Singh', 'PENDING_CHALLAN', 1, '[]'
);

// History timeline for ulpin1
const timeline = [
  {
    year: 2018,
    badge: '2018 (OPEN LAND) • JAMABANDI 2017-18',
    desc: '2018 (Open Land): Original Jamabandi Revenue Record under Late S. Balwant Singh. Vacant agricultural parcel (Khasra No. 412/1), no superstructure. Subterranean municipal right-of-way established.',
    owner: 'Late Sardar Balwant Singh (Father)',
    khata: 'KH-2018/142 (Khewat 88)',
    tax: '₹850 (Rural Land Cess - Paid)',
    scanDate: 'Patwari Chain Survey (Pre-Drone era)',
    anomaly: 0,
    levels: ['B30']
  },
  {
    year: 2020,
    badge: '2020 (G0 FOUNDATION) • MCA SANCTION',
    desc: '2020 (Foundation & Plinth): Building sanction approved by Municipal Corporation Amritsar (#MCA/2020/094). Foundation piles sunk to -30ft bedrock. G00 Ground Floor stilt structure cast.',
    owner: 'Late Sardar Balwant Singh',
    khata: 'KH-2020/198 (Khewat 88)',
    tax: '₹3,200 (Plinth Construction Cess - Paid)',
    scanDate: 'MCA Municipal Inspector Physical Audit',
    anomaly: 0,
    levels: ['B30', 'G00']
  },
  {
    year: 2023,
    badge: '2023 (G+1 APPROVED) • CITIZEN REGISTRATION',
    desc: '2023 (Approved 2 Floors): Mutation deed registered in favor of Sardar Harpreet Singh (Son). Approved sanction: Stilt Ground + Level 1. Sub-ULPINs BCN501B1NA2CH0-G00 and F01 minted.',
    owner: 'Sardar Harpreet Singh (Inherited Mutation #MUT-2023-88)',
    khata: 'KH-2023/782 (Khewat 88 / Khatouni 142)',
    tax: '₹14,200 (Annual Urban Land Tax - Paid)',
    scanDate: 'Total Station Survey (Amritsar Development Authority)',
    anomaly: 0,
    levels: ['B30', 'G00', 'F01']
  },
  {
    year: 2026,
    badge: '2026 (AUTONOMOUS 3D SLAM) • 24H STATUTORY NOTICE',
    desc: '2026 (LiDAR Violation Detected): Autonomous Municipal Drone LiDAR SLAM 3R flight detected unauthorized Level 2 rooftop construction (+3.2m height excess, 1,150 sqft encroachment). Level F02 flagged with Section 187 Notice.',
    owner: 'Sardar Harpreet Singh',
    khata: 'KH-2026/782 (Encroachment Notice Active)',
    tax: '₹14,200 (Base Paid) + ₹35,000 (Challan Pending)',
    scanDate: 'Autonomous Drone Survey (04-Feb-2026 09:30 AM)',
    anomaly: 1,
    levels: ['B30', 'G00', 'F01', 'F02']
  }
];

timeline.forEach(t => {
  insertHistory.run(
    ulpin1, t.year, t.badge, t.desc, t.owner,
    t.khata, t.tax, t.scanDate, t.anomaly, JSON.stringify(t.levels)
  );
});

// Parcel 2: BCN501C2KB4M10 (Statutory Commercial Plot - Mall Road)
const ulpin2 = 'BCN501C2KB4M10';
const coords2 = [
  [74.862410, 31.611200],
  [74.862910, 31.611200],
  [74.862910, 31.611680],
  [74.862410, 31.611680],
  [74.862410, 31.611200]
];
insertParcel.run(
  ulpin2, 'parcel-2', 'Khasra No. 518/3', 'KH-2024/912',
  'Mall Road Commercial Cadastre Division', 'Amritsar-I (Urban)', 'Amritsar, Punjab',
  'Sardar Harpreet Singh', 'XXXX-XXXX-8921', 'FLAGGED_VIOLATION', 3, 2,
  1, 'Commercial CLU Notice: Ground Floor Showroom & Level 2 Rooftop Penthouse (+3.2m height excess). Commercial tax reassessment pending.', 28500, 'PAID', JSON.stringify(coords2), 31.611440, 74.862660, '12-May-2023', '04-Feb-2026'
);
insertLevel.run(
  `${ulpin2}-B30-UTL`, ulpin2, 'B30', 'Subterranean Foundation (-30 ft / -9.14 m)',
  1, -30.0, 9.14, 1200, 'Government / Municipal Corporation of Amritsar (MCA)', 'PAID', 0, JSON.stringify(utilities)
);
insertLevel.run(
  `${ulpin2}-G00-LBY`, ulpin2, 'G00', 'Ground Floor (Commercial Retail Showroom)',
  0, 0, 3.2, 1150, 'Sardar Harpreet Singh', 'PAID', 0, '[]'
);
insertLevel.run(
  `${ulpin2}-F01-U01`, ulpin2, 'F01', 'Level 1 - Commercial Office Space',
  0, 0, 3.0, 1190, 'Sardar Harpreet Singh', 'PAID', 0, '[]'
);
insertLevel.run(
  `${ulpin2}-F02-U02`, ulpin2, 'F02', 'Level 2 - Unauthorized Rooftop Penthouse Extension',
  0, 0, 3.2, 1150, 'Sardar Harpreet Singh', 'PENDING_CHALLAN', 1, '[]'
);

// Parcel 3: BCN501D3LC5N20 (Statutory Residential Twin - Ranjit Avenue)
const ulpin3 = 'BCN501D3LC5N20';
const coords3 = [
  [74.863800, 31.612800],
  [74.864300, 31.612800],
  [74.864300, 31.613300],
  [74.863800, 31.613300],
  [74.863800, 31.612800]
];
insertParcel.run(
  ulpin3, 'parcel-3', 'Khasra No. 302/9', 'KH-2024/401',
  'Ranjit Avenue Sector D', 'Amritsar-II', 'Amritsar, Punjab',
  'Sardar Harpreet Singh', 'XXXX-XXXX-8921', 'PENDING_REGISTRATION', 1, 1,
  0, null, 4200, 'PAID', JSON.stringify(coords3), 31.613050, 74.864050, '10-Oct-2022', 'Awaiting Autonomous Scan'
);
insertLevel.run(
  `${ulpin3}-B30-UTL`, ulpin3, 'B30', 'Subterranean Foundation (-30 ft / -9.14 m)',
  1, -30.0, 9.14, 1200, 'Government / Municipal Corporation of Amritsar (MCA)', 'PAID', 0, JSON.stringify(utilities)
);
insertLevel.run(
  `${ulpin3}-G00-LBY`, ulpin3, 'G00', 'Ground Floor (Residential Living)',
  0, 0, 3.2, 1100, 'Sardar Harpreet Singh', 'PAID', 0, '[]'
);

// Parcel 4: BCN501F5NE7Q40 (Digitalized 3D Twin - Model Town Villa)
const ulpin5 = 'BCN501F5NE7Q40';
const coords5 = [
  [74.865100, 31.614200],
  [74.865600, 31.614200],
  [74.865600, 31.614700],
  [74.865100, 31.614700],
  [74.865100, 31.614200]
];
insertParcel.run(
  ulpin5, 'parcel-5', 'Khasra No. 214/5', 'KH-2024/630',
  'Model Town Residential Sector', 'Amritsar-I (Urban)', 'Amritsar, Punjab',
  'Sardar Harpreet Singh', 'XXXX-XXXX-8921', 'DIGITALIZED', 2, 2,
  0, null, 18600, 'PAID', JSON.stringify(coords5), 31.614450, 74.865350, '15-Mar-2023', '12-Jan-2026'
);
insertLevel.run(
  `${ulpin5}-B30-UTL`, ulpin5, 'B30', 'Subterranean Foundation (-30 ft / -9.14 m)',
  1, -30.0, 9.14, 1200, 'Government / Municipal Corporation of Amritsar (MCA)', 'PAID', 0, JSON.stringify(utilities)
);
insertLevel.run(
  `${ulpin5}-G00-LBY`, ulpin5, 'G00', 'Ground Floor (Family Lounge & Garden Villa)',
  0, 0, 3.2, 1250, 'Sardar Harpreet Singh', 'PAID', 0, '[]'
);
insertLevel.run(
  `${ulpin5}-F01-U01`, ulpin5, 'F01', 'Level 1 - Master Bedrooms Suite',
  0, 0, 3.0, 1280, 'Sardar Harpreet Singh', 'PAID', 0, '[]'
);

// Parcel 5: BCN501E4MD6P30 (Statutory Encroachment - Gurcharan Singh)
const ulpin4 = 'BCN501E4MD6P30';
const coords4 = [
  [74.86124, 31.61113],
  [74.86184, 31.61113],
  [74.86184, 31.61158],
  [74.86124, 31.61158],
  [74.86124, 31.61113]
];
insertParcel.run(
  ulpin4, 'parcel-violation-2', 'Khasra No. 308/2', 'KH-2024/308',
  'Kot Atma Singh / Heritage Cadastre Zone', 'Amritsar-I (Urban)', 'Amritsar, Punjab',
  'Gurcharan Singh', 'XXXX-XXXX-4019', 'FLAGGED_VIOLATION', 2, 2,
  1, 'Ground penetrating radar detected -15ft basement encroachment into municipal gas conduit right-of-way (Sec 187 Notice)',
  18500, 'NOTICE_ISSUED', JSON.stringify(coords4), 31.61135, 74.86154, '10-Nov-2022', '08-Feb-2026'
);
insertLevel.run(
  `${ulpin4}-B15-ENC`, ulpin4, 'B15', 'Basement Level -15ft (Encroaching Gas Conduit)',
  1, -15.0, 4.5, 980, 'Gurcharan Singh', 'PENALTY_NOTICE', 1, '[]'
);
insertLevel.run(
  `${ulpin4}-B30-UTL`, ulpin4, 'B30', 'Subterranean Foundation (-30 ft / -9.14 m)',
  1, -30.0, 9.14, 1200, 'Government / Municipal Corporation of Amritsar (MCA)', 'PAID', 0, JSON.stringify(utilities)
);
insertLevel.run(
  `${ulpin4}-G00-LBY`, ulpin4, 'G00', 'Ground Floor (Stilt Commercial)',
  0, 0, 3.2, 1150, 'Gurcharan Singh', 'PAID', 0, '[]'
);
insertLevel.run(
  `${ulpin4}-F01-U01`, ulpin4, 'F01', 'Level 1 - Residential Unit',
  0, 0, 3.0, 1190, 'Gurcharan Singh', 'PAID', 0, '[]'
);

// Also populate buildings from punjab_3d_buildings.json so /api/parcels has complete coverage
const buildingsJsonPath = path.join(__dirname, '..', 'src', 'data', 'punjab_3d_buildings.json');
if (fs.existsSync(buildingsJsonPath)) {
  const bData = JSON.parse(fs.readFileSync(buildingsJsonPath, 'utf8'));
  console.log(`📦 Seeding up to 250 sample buildings from ${bData.features.length} 3D buildings dataset into SQLite...`);
  
  const sample = bData.features.slice(0, 250);
  sample.forEach((f, idx) => {
    const p = f.properties;
    if ([ulpin1, ulpin2, ulpin3, ulpin4].includes(p.ulpin)) return; // Already inserted

    const coords = f.geometry?.coordinates?.[0] || coords1;
    let cLat = 31.610341, cLng = 74.859979;
    if (coords && coords.length > 0) {
      cLng = coords[0][0];
      cLat = coords[0][1];
    }

    try {
      insertParcel.run(
        p.ulpin,
        `parcel-b-${p.id || idx + 10}`,
        p.survey_no || `Khasra No. ${100 + idx}/1`,
        `KH-2024/${200 + idx}`,
        p.locality || 'Amritsar Cadastre Zone',
        p.tehsil || 'Amritsar-I',
        `${p.district || 'Amritsar'}, Punjab`,
        p.owner || 'Registered Citizen',
        'XXXX-XXXX-9900',
        p.status || (p.is_pending ? 'PENDING_REGISTRATION' : (p.has_anomaly ? 'FLAGGED_VIOLATION' : 'DIGITALIZED')),
        p.total_floors || 1,
        p.has_anomaly ? (p.total_floors - 1) : (p.total_floors || 1),
        p.has_anomaly ? 1 : 0,
        p.anomaly_desc || null,
        p.tax_amount || 14200,
        p.tax_status || 'PAID',
        JSON.stringify(coords),
        cLat,
        cLng,
        '14-Jan-2024',
        p.drone_scan_date || '14-Jan-2026'
      );
    } catch (e) {}
  });
}

console.log('✅ cadastre.db successfully re-seeded with 14-digit ULPINs!');
const count = db.prepare('SELECT COUNT(*) as c FROM parcels').get();
console.log(`📊 Total parcels in SQLite: ${count.c}`);
const citizen = db.prepare("SELECT * FROM citizens WHERE name LIKE '%Harpreet%'").get();
console.log('👤 Harpreet Singh properties in DB:', citizen.properties_json);
