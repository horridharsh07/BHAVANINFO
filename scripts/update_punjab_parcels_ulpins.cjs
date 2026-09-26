const fs = require('fs');
let code = fs.readFileSync('src/data/punjab_parcels.js', 'utf8');

// Update parcel-2
code = code.replace(
  '"id": "parcel-2",\n    "ulpin": "PB020011013082"',
  '"id": "parcel-2",\n    "ulpin": "BCN501C2KB4M10",\n    "legacy_ulpin": "PB020011013082"'
);
code = code.split('PB020011013082-').join('BCN501C2KB4M10-');

// Update parcel-3
code = code.replace(
  '"id": "parcel-3",\n    "ulpin": "PB020011012201"',
  '"id": "parcel-3",\n    "ulpin": "BCN501D3LC5N20",\n    "legacy_ulpin": "PB020011012201"'
);
code = code.split('PB020011012201-').join('BCN501D3LC5N20-');

// Update user properties_owned
code = code.replace(
  'properties_owned: ["BCN501B1NA2CH0", "PB020011014121", "PB020011013082", "PB020011012201"]',
  'properties_owned: ["BCN501B1NA2CH0", "BCN501C2KB4M10", "BCN501D3LC5N20", "PB020011014121", "PB020011013082", "PB020011012201"]'
);

fs.writeFileSync('src/data/punjab_parcels.js', code, 'utf8');
console.log('✅ Successfully updated punjab_parcels.js!');
