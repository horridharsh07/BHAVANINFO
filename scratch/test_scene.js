const THREE = require('../vendor/three.min.js');

const parcel = {
  coordinates: [
    [74.8620, 31.6125],
    [74.8626, 31.6125],
    [74.8626, 31.6131],
    [74.8620, 31.6131]
  ]
};

const coords = parcel.coordinates;
const lons = coords.map(c => c[0]);
const lats = coords.map(c => c[1]);
const minLon = Math.min(...lons), maxLon = Math.max(...lons);
const minLat = Math.min(...lats), maxLat = Math.max(...lats);
const centerLon = (minLon + maxLon) / 2;
const centerLat = (minLat + maxLat) / 2;

const metersPerLat = 111320;
const metersPerLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

const localPoints = coords.map(c => {
  const x = (c[0] - centerLon) * metersPerLon;
  const z = -(c[1] - centerLat) * metersPerLat;
  return { x, z };
});

const xs = localPoints.map(p => p.x);
const zs = localPoints.map(p => p.z);
const rawWidth = Math.max(...xs) - Math.min(...xs);
const rawLength = Math.max(...zs) - Math.min(...zs);

let scale = 1.0;
const maxDim = Math.max(rawWidth, rawLength);
if (maxDim < 8) scale = 16 / Math.max(1, maxDim);
else if (maxDim > 35) scale = 28 / maxDim;

const scaledPoints = localPoints.map(p => ({
  x: p.x * scale,
  z: p.z * scale
}));

console.log('scaledPoints:', scaledPoints);

const shape = new THREE.Shape();
shape.moveTo(scaledPoints[0].x, -scaledPoints[0].z);
for (let i = 1; i < scaledPoints.length; i++) {
  shape.lineTo(scaledPoints[i].x, -scaledPoints[i].z);
}
shape.closePath();

const slabThickness = 0.45;
const slabGeo = new THREE.ExtrudeGeometry(shape, {
  depth: slabThickness,
  bevelEnabled: true,
  bevelSegments: 2,
  bevelSize: 0.12,
  bevelThickness: 0.06
});
console.log('slabGeo before rotate:', new THREE.Box3().setFromBufferAttribute(slabGeo.attributes.position));
slabGeo.rotateX(-Math.PI / 2);
console.log('slabGeo after rotate:', new THREE.Box3().setFromBufferAttribute(slabGeo.attributes.position));

const wallHeight = 2.85;
const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: wallHeight, bevelEnabled: false });
console.log('wallGeo before rotate:', new THREE.Box3().setFromBufferAttribute(wallGeo.attributes.position));
wallGeo.rotateX(-Math.PI / 2);
console.log('wallGeo after rotate:', new THREE.Box3().setFromBufferAttribute(wallGeo.attributes.position));
