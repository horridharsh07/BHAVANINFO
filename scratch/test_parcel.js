const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname, '../cadastre.db'));

// Let's check all parcels in cadastre.db
const allParcels = db.prepare('SELECT * FROM parcels').all();
console.log('All parcels in DB count:', allParcels.length);
allParcels.forEach(p => {
  const levels = db.prepare('SELECT * FROM sub_ulpins WHERE parcel_ulpin = ?').all(p.ulpin);
  console.log(`ULPIN: ${p.ulpin}, total_floors: ${p.total_floors}, levels in DB: ${levels.length}`);
  levels.forEach(l => console.log(`   level_code: ${l.level_code}, name: ${l.name}, is_subterranean: ${l.is_subterranean}`));
});
