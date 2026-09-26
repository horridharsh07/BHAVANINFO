const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, '..', 'src', 'map2d.js');
let code = fs.readFileSync(mapPath, 'utf8');

const oldHudBlock = `    this.hoverHud.innerHTML = \`
      <div class="hud-header">Department of Land Resources &bull; Bhu-Aadhaar</div>
      <div class="hud-ulpin">\${props.ulpin || 'PB020011014121'}</div>
      <div class="hud-meta">
        <div><strong>Survey No:</strong> \${props.survey_no || 'Khasra No. 412/1'}</div>
        <div><strong>Owner:</strong> \${props.owner || 'Citizen Landowner'}</div>
        <div><strong>Locality:</strong> \${props.locality || 'Amritsar Urban'}, \${props.district || 'Punjab'}</div>
        <div><strong>GPS Location:</strong> <span style="font-family: monospace;">\${lat.toFixed(5)}° N, \${lng.toFixed(5)}° E</span></div>
        <div><strong>Plot Area:</strong> \${areaText} &bull; <strong>Built-Up:</strong> \${builtUpSqft.toLocaleString()} sq.ft \${farText}</div>
        \${floorsHtml}
        <div><strong>Status:</strong> \${statusHtml}</div>
        <div>
          <a href="\${gmapsUrl}" target="_blank" class="hud-gmaps-link" onclick="event.stopPropagation()">
            <span>📍</span> Open Google Maps Directions ↗
          </a>
        </div>
      </div>
      <div class="hud-hint">⚡ Click Building to Open 3D Inspector &amp; Floor Slicer &rarr;</div>
    \`;`;

const newHudBlock = `    const bhu = window.app && window.app.getBhuNakshaRecord ? window.app.getBhuNakshaRecord(props) : {
      district: props.district || 'Amritsar',
      tehsil: props.tehsil || 'Amritsar-I',
      hadbastNo: '101',
      khasraNo: (props.survey_no || 'Khasra No. 412/1').replace(/Khasra No\\.\\s*/i, ''),
      khewatNo: '88',
      kanalMarla: '0 Kanal 7 Marla (' + areaText + ')'
    };

    this.hoverHud.innerHTML = \`
      <div class="hud-header">Department of Land Resources &bull; Bhu-Aadhaar</div>
      <div class="hud-ulpin">\${props.ulpin || 'PB020011014121'}</div>

      <!-- BhuNaksha Live Sync Banner -->
      <div class="hud-bhunaksha-banner">
        <span>🏛️ BhuNaksha: Hadbast #\${bhu.hadbastNo} &bull; Khasra #\${bhu.khasraNo}</span>
        <button type="button" class="hud-btn-copy" onclick="event.stopPropagation(); window.app && window.app.copyBhuNakshaDetails('\${props.ulpin}')">
          📋 Copy Record
        </button>
      </div>

      <div class="hud-meta">
        <div><strong>Khasra No (ਖਸਰਾ ਨੰ:):</strong> <span style="font-family: monospace; font-weight: 700; color: #0284c7;">Khasra No. \${bhu.khasraNo}</span></div>
        <div><strong>Owner (ਮਾਲਕ):</strong> \${props.owner || 'Citizen Landowner'}</div>
        <div><strong>Village / Hadbast:</strong> \${bhu.village || props.locality || 'Kot Atma Singh'} (Hadbast #\${bhu.hadbastNo})</div>
        <div><strong>District &amp; Tehsil:</strong> \${bhu.district} &bull; \${bhu.tehsil}</div>
        <div><strong>Cadastral Area (ਰਕਬਾ):</strong> \${bhu.kanalMarla}</div>
        <div><strong>GPS Location:</strong> <span style="font-family: monospace;">\${lat.toFixed(5)}° N, \${lng.toFixed(5)}° E</span></div>
        \${floorsHtml}
        <div><strong>Status:</strong> \${statusHtml}</div>
        <div style="display: flex; gap: 6px; margin-top: 5px;">
          <a href="\${gmapsUrl}" target="_blank" class="hud-gmaps-link" style="flex: 1;" onclick="event.stopPropagation()">
            <span>📍</span> Google Maps ↗
          </a>
          <a href="https://jamabandi.punjab.gov.in/" target="_blank" class="hud-gmaps-link" style="flex: 1; color: #15803d; border-color: #86efac; background: #f0fdf4;" onclick="event.stopPropagation()">
            <span>🌐</span> jamabandi.punjab.gov.in ↗
          </a>
        </div>
      </div>
      <div class="hud-hint">⚡ Click Building to Open 3D Inspector &amp; BhuNaksha RoR &rarr;</div>
    \`;`;

if (code.includes(oldHudBlock)) {
  code = code.replace(oldHudBlock, newHudBlock);
  fs.writeFileSync(mapPath, code, 'utf8');
  console.log('✅ Updated src/map2d.js with BhuNaksha hover HUD!');
} else {
  console.error('❌ Could not find exact oldHudBlock in src/map2d.js');
}
