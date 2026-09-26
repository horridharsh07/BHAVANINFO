const fs = require('fs');
const readline = require('readline');

async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream('punjab_amritsar_buildings.geojson'),
    crlfDelay: Infinity
  });

  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  let count = 0;
  let polyCount = 0;
  let multiPolyCount = 0;

  for await (const line of rl) {
    if (line.includes('"type":"Feature"')) {
      let str = line.trim();
      if (str.endsWith(',')) str = str.slice(0, -1);
      try {
        const f = JSON.parse(str);
        if (f.geometry && f.geometry.type === 'Polygon') {
          polyCount++;
          count++;
          const ring = f.geometry.coordinates[0];
          for (const pt of ring) {
            if (pt[0] < minLon) minLon = pt[0];
            if (pt[0] > maxLon) maxLon = pt[0];
            if (pt[1] < minLat) minLat = pt[1];
            if (pt[1] > maxLat) maxLat = pt[1];
          }
        } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
          multiPolyCount++;
          count++;
        }
      } catch (e) {}
    }
  }

  console.log(`Analyzed ${count} features: ${polyCount} Polygons, ${multiPolyCount} MultiPolygons`);
  console.log(`Longitude Range: [${minLon.toFixed(6)}, ${maxLon.toFixed(6)}]`);
  console.log(`Latitude Range: [${minLat.toFixed(6)}, ${maxLat.toFixed(6)}]`);
  console.log(`Center: [${((minLon + maxLon)/2).toFixed(6)}, ${((minLat + maxLat)/2).toFixed(6)}]`);
}

run();
