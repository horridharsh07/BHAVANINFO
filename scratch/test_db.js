const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname, '../cadastre.db'));

const parcels = db.prepare('SELECT ulpin, total_floors, declared_floors, status, has_anomaly FROM parcels').all();
console.log('Parcels in DB:');
parcels.forEach(p => console.log(p));
