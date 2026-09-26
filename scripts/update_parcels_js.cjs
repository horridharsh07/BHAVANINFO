const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'src', 'data', 'punjab_parcels.js');
let code = fs.readFileSync(targetFile, 'utf8');

// Map old primary IDs:
code = code.replace(/PB02-8599-6103/g, 'PB020011014121');
code = code.replace(/PB02-8603-6101/g, 'PB020011013082');
code = code.replace(/PB02-8604-6100/g, 'PB020011012201');
code = code.replace(/PB02-8612-4019/g, 'PB020011014019');

// Replace any remaining PB02-xxxx-xxxx with PB02001101xxxx (14 chars)
// PB (2) + 02 (2) + 001 (3) + 101 (3) + 4-digit plot = 14 chars!
code = code.replace(/PB02-(\d{4})-(\d{4})/g, (match, p1, p2) => {
  return 'PB02001101' + p2;
});

// Replace sub_ulpins like PB02-86xx-xxxx-B30-UTL
code = code.replace(/PB02-(\d{4})-(\d{4})-([A-Za-z0-9_\-]+)/g, (match, p1, p2, p3) => {
  return 'PB02001101' + p2 + '-' + p3;
});

// Update CURRENT_USER properties_owned
code = code.replace(/"properties_owned":\s*\[[^\]]+\]/, '"properties_owned": ["PB020011014121", "PB020011013082", "PB020011012201"]');

fs.writeFileSync(targetFile, code, 'utf8');
console.log('✅ Updated src/data/punjab_parcels.js with 14-digit ULPINs!');

// Verify
const updated = fs.readFileSync(targetFile, 'utf8');
const oldMatches = updated.match(/PB02-\d{4}/g);
console.log('Old format occurrences remaining:', oldMatches ? oldMatches.length : 0);
const newMatches = updated.match(/PB02001101\d{4}/g);
console.log('New 14-digit format occurrences:', newMatches ? newMatches.length : 0);
