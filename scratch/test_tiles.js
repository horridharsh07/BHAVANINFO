async function test() {
  const urls = [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/0/0/0',
    'https://tile.openstreetmap.org/0/0/0.png',
    'https://basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png',
    'http://localhost:3000/src/data/punjab_3d_buildings.json'
  ];
  for (const u of urls) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(u, { signal: controller.signal });
      clearTimeout(id);
      console.log(`OK: ${u} -> status ${res.status}`);
    } catch (e) {
      console.log(`FAIL: ${u} -> ${e.message}`);
    }
  }
}
test();
