const fs = require('fs');
const readline = require('readline');

async function inspect() {
  const fileStream = fs.createReadStream('punjab_amritsar_buildings.geojson');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let sample = null;

  for await (const line of rl) {
    if (line.includes('"type":"Feature"')) {
      count++;
      if (!sample) {
        try {
          // clean trailing comma
          let jsonStr = line.trim();
          if (jsonStr.endsWith(',')) jsonStr = jsonStr.slice(0, -1);
          sample = JSON.parse(jsonStr);
        } catch (e) {}
      }
    }
  }

  console.log('Total real buildings in punjab_amritsar_buildings.geojson:', count);
  console.log('Sample building:', JSON.stringify(sample, null, 2));
}

inspect();
