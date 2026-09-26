const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. History building tag
html = html.replace(
  '<span id="history-building-tag" style="font-family: monospace; font-size: 0.75rem; background: #f0f9ff; color: #0284c7; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd; font-weight: 700;">PB02-8599-6103</span>',
  '<span id="history-building-tag" style="font-family: monospace; font-size: 0.75rem; background: #f0f9ff; color: #0284c7; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd; font-weight: 700;">PB020011014121</span>'
);

// 2. Rule 2 Code example
html = html.replace(
  '<code>PB02-8600-XXXX-G00</code>',
  '<code>PB020011014121-G00</code>'
);

// 3. Landing page SHA table rows
html = html.replace(
  '<code>PB02-8599-6103</code>',
  '<code>PB020011014121</code>'
);
html = html.replace(
  '<code>PB02-8612-4019</code>',
  '<code>PB020011014019</code>'
);
html = html.replace(
  '<code>PB02-8605-1025</code>',
  '<code>PB020011013082</code>'
);
html = html.replace(
  '<code>PB02-8620-4663</code>',
  '<code>PB020011012201</code>'
);

// 4. Officer dashboard table
html = html.replace(
  '<td style="padding: 10px; font-family: monospace; font-weight: 700; color: #0369a1;">PB02-8599-6103</td>',
  '<td style="padding: 10px; font-family: monospace; font-weight: 700; color: #0369a1;">PB020011014121</td>'
);
html = html.replace(
  "onclick=\"window.app.inspectParcel('PB02-8599-6103')\"",
  "onclick=\"window.app.inspectParcel('PB020011014121')\""
);
html = html.replace(
  '<td style="padding: 10px; font-family: monospace; font-weight: 700; color: #0369a1;">PB02-8612-4019</td>',
  '<td style="padding: 10px; font-family: monospace; font-weight: 700; color: #0369a1;">PB020011014019</td>'
);
html = html.replace(
  "onclick=\"window.app.locateOnMap('PB02-8612-4019')\"",
  "onclick=\"window.app.locateOnMap('PB020011014019')\""
);

// 5. Dossier Header & 14-Digit Bhu-Aadhaar Structure Decoder
const oldDossierHeader = `<div class="dossier-header">
            <button id="btn-back-to-map" class="dossier-nav-back">&larr; Back to Map</button>
            <h3>BHAVANINFO Digital Twin Dossier</h3>
            <div id="dossier-ulpin-val" class="dossier-ulpin">PB02-8605-1025</div>
            <div style="font-size: 0.75rem; color: #cfe1f7; margin-top: 2px;">ISO 19152 (LADM 3D) Verified Record</div>
          </div>`;

const newDossierHeader = `<div class="dossier-header">
            <button id="btn-back-to-map" class="dossier-nav-back">&larr; Back to Map</button>
            <h3>BHAVANINFO Digital Twin Dossier</h3>
            <div id="dossier-ulpin-val" class="dossier-ulpin">PB020011014121</div>
            <div style="font-size: 0.75rem; color: #cfe1f7; margin-top: 2px;">ISO 19152 (LADM 3D) Verified Record</div>

            <!-- 14-Digit Bhu-Aadhaar Structure Breakdown Badge & Inspector -->
            <div class="ulpin-decoder-wrap">
              <div class="ulpin-decoder-title">
                <span>🇮🇳 BHU-AADHAAR (ULPIN) 14-DIGIT STATUTORY STANDARD</span>
              </div>
              <div class="ulpin-segment-grid">
                <div class="ulpin-seg-box" title="Digits 1–2: State Code (PB = Punjab)">
                  <span class="seg-code" id="ulpin-seg-state">PB</span>
                  <span class="seg-label">State</span>
                </div>
                <div class="ulpin-seg-box" title="Digits 3–4: District Code (02 = Amritsar)">
                  <span class="seg-code" id="ulpin-seg-dist">02</span>
                  <span class="seg-label">Dist</span>
                </div>
                <div class="ulpin-seg-box" title="Digits 5–7: Sub-district / Tehsil Code (001 = Amritsar-I)">
                  <span class="seg-code" id="ulpin-seg-tehsil">001</span>
                  <span class="seg-label">Tehsil</span>
                </div>
                <div class="ulpin-seg-box" title="Digits 8–10: Village / Cadastre Division Code (101 = Heritage Zone)">
                  <span class="seg-code" id="ulpin-seg-village">101</span>
                  <span class="seg-label">Village</span>
                </div>
                <div class="ulpin-seg-box highlight" title="Digits 11–14: Unique Plot Identifier (4121 = Plot 412/1)">
                  <span class="seg-code" id="ulpin-seg-plot">4121</span>
                  <span class="seg-label">Plot ID</span>
                </div>
              </div>
              <div class="ulpin-breakdown-details" id="ulpin-breakdown-desc">
                <div class="bhu-aadhaar-pill-row">
                  <span class="bhu-pill">📍 Punjab (PB)</span>
                  <span class="bhu-pill">🏛️ Amritsar (02)</span>
                  <span class="bhu-pill">🏘️ Tehsil-001</span>
                  <span class="bhu-pill">📜 Cadastre 101</span>
                  <span class="bhu-pill plot-pill">📐 Plot #4121</span>
                </div>
              </div>
            </div>
          </div>`;

if (html.includes(oldDossierHeader)) {
  html = html.replace(oldDossierHeader, newDossierHeader);
  console.log('✅ Updated Dossier Header with 14-Digit ULPIN Decoder!');
} else {
  console.log('⚠️ Could not find exact oldDossierHeader, replacing individual parts...');
  html = html.replace(
    '<div id="dossier-ulpin-val" class="dossier-ulpin">PB02-8605-1025</div>',
    '<div id="dossier-ulpin-val" class="dossier-ulpin">PB020011014121</div>'
  );
}

// 6. Pending Drone SLAM survey overlay
html = html.replace(
  '<strong id="pending-ulpin-val">PB02-8604-6100</strong>',
  '<strong id="pending-ulpin-val">PB020011012201</strong>'
);

// 7. Citizen receipt
html = html.replace(
  '<strong id="receipt-ulpin-val" class="val" style="color: #0284c7; font-family: monospace;">PB02-8630-9941</strong>',
  '<strong id="receipt-ulpin-val" class="val" style="color: #0284c7; font-family: monospace;">PB020011019941</strong>'
);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('✅ index.html updated successfully!');

// Verification of any remaining PB02-
const updatedHtml = fs.readFileSync(indexPath, 'utf8');
const remaining = updatedHtml.match(/PB02-[A-Za-z0-9\-]+/g);
console.log('Remaining old ULPIN format matches in index.html:', remaining ? remaining : 'None (0)!');
