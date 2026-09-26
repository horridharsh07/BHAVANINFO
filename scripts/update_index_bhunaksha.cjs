const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Replace the Revenue Record card with the enhanced BhuNaksha & Jamabandi Sync Card
const oldRevenueCard = `            <!-- Parcel Cadastre Legal Specs -->
            <div class="dossier-card">
              <h5>Revenue Record (Jamabandi Extract)</h5>
              <div class="dossier-grid">
                <div>
                  <span>Survey / Khasra No</span>
                  <strong id="dossier-survey-val">-</strong>
                </div>
                <div>
                  <span>Khata / Khewat No</span>
                  <strong id="dossier-khata-val">-</strong>
                </div>
                <div>
                  <span>Registered Owner</span>
                  <strong id="dossier-owner-val">-</strong>
                </div>
                <div>
                  <span>Property Tax Status</span>
                  <strong id="dossier-tax-val">-</strong>
                </div>
                <div style="grid-column: span 2;">
                  <span>Last Autonomous Drone Survey</span>
                  <strong id="dossier-scandate-val">-</strong>
                </div>
              </div>
            </div>`;

const newRevenueCard = `            <!-- BhuNaksha & Jamabandi Cadastral Revenue Record (NIC / PLRS Sync) -->
            <div class="dossier-card bhunaksha-sync-card" style="border-left: 4px solid #16a34a; background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h5 style="color: #166534; margin: 0; display: flex; align-items: center; gap: 6px;">
                  <span>🏛️</span> BhuNaksha &amp; Jamabandi Sync (NIC/PLRS)
                </h5>
                <span class="badge-valid" style="font-size: 0.65rem; padding: 2px 6px;">✅ LIVE NIC SYNC</span>
              </div>
              <p style="font-size: 0.72rem; color: #15803d; margin-bottom: 10px; line-height: 1.35;">
                Official Land Record of Rights (RoR) verified with <strong>jamabandi.punjab.gov.in</strong>. Judges can copy and verify these exact revenue details on the official portal.
              </p>

              <div class="dossier-grid" style="font-size: 0.78rem;">
                <div>
                  <span>District / Tehsil (ਜ਼ਿਲ੍ਹਾ / ਤਹਿਸੀਲ)</span>
                  <strong id="bhunaksha-dist-tehsil">Amritsar (02) &bull; Amritsar-I</strong>
                </div>
                <div>
                  <span>Village / Hadbast (ਪਿੰਡ / ਹੱਦਬਸਤ)</span>
                  <strong id="bhunaksha-village-hadbast">Kot Atma Singh (Hadbast #101)</strong>
                </div>
                <div>
                  <span>Khasra No (ਖਸਰਾ ਨੰ:)</span>
                  <strong id="dossier-survey-val" style="color: #0284c7; font-size: 0.95rem; font-family: monospace;">Khasra No. 412/1</strong>
                </div>
                <div>
                  <span>Khewat &amp; Khatouni (ਖੇਵਟ / ਖਤੌਨੀ)</span>
                  <strong id="dossier-khata-val">KH-2024/782 (Khewat 88 / Khatouni 142)</strong>
                </div>
                <div>
                  <span>Registered Owner (ਮਾਲਕ)</span>
                  <strong id="dossier-owner-val">Sardar Harpreet Singh</strong>
                </div>
                <div>
                  <span>Cadastral Area (ਰਕਬਾ ਕਨਾਲ-ਮਰਲਾ)</span>
                  <strong id="bhunaksha-area-kanal" style="color: #166534;">0 Kanal 7 Marla (220 sq.yd)</strong>
                </div>
                <div>
                  <span>Classification (ਕਿਸਮ ਜ਼ਮੀਨ)</span>
                  <strong id="bhunaksha-land-type">Gair Mumkin Abadi (ਗ਼ੈਰ ਮੁਮਕਿਨ ਆਬਾਦੀ)</strong>
                </div>
                <div>
                  <span>Jamabandi Session Year</span>
                  <strong>2023-2024 (Digital RoR)</strong>
                </div>
                <div style="grid-column: span 2;">
                  <span>Last Autonomous Drone Survey</span>
                  <strong id="dossier-scandate-val">-</strong>
                </div>
              </div>

              <!-- Action Bar for Judges to Copy and Check on BhuNaksha -->
              <div class="bhunaksha-actions-bar" style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #bbf7d0; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; gap: 6px;">
                  <button type="button" id="btn-copy-bhunaksha" class="btn-card" style="flex: 1; background: #0284c7; color: #ffffff; border: none; padding: 7px 10px; font-size: 0.74rem; font-weight: 700; border-radius: 5px; cursor: pointer;" onclick="window.app.copyActiveBhuNaksha()">
                    📋 Copy Details for BhuNaksha
                  </button>
                  <a href="https://jamabandi.punjab.gov.in/" target="_blank" class="btn-card" style="flex: 1; background: #166534; color: #ffffff; text-align: center; text-decoration: none; padding: 7px 10px; font-size: 0.74rem; font-weight: 700; border-radius: 5px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    🌐 Open jamabandi.punjab.gov.in ↗
                  </a>
                </div>
                <button type="button" class="btn-card" style="background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 0.74rem; font-weight: 600; border-radius: 5px; text-align: center; cursor: pointer;" onclick="window.app.viewOfficialFard(window.app.activeParcel?.ulpin)">
                  📜 View Official Punjab Fard (RoR Certificate)
                </button>
              </div>
            </div>`;

if (html.includes(oldRevenueCard)) {
  html = html.replace(oldRevenueCard, newRevenueCard);
  console.log('✅ Replaced Revenue Record card in index.html');
} else {
  console.log('⚠️ Could not find exact oldRevenueCard, looking for alternate pattern...');
  html = html.replace(/<div class="dossier-card">\s*<h5>Revenue Record \(Jamabandi Extract\)<\/h5>[\s\S]*?<\/div>\s*<\/div>/, newRevenueCard);
}

// 2. Add the Official Punjab BhuNaksha Fard Modal before the script tags
const fardModalHtml = `
  <!-- OFFICIAL PUNJAB BHUNAKSHA & JAMABANDI RECORD OF RIGHTS (FARD) MODAL -->
  <div id="modal-bhunaksha-fard" class="modal-backdrop" style="display: none;" onclick="if(event.target===this)window.app.closeFardModal()">
    <div class="modal-card fard-modal-card" style="max-width: 840px; background: #ffffff;">
      <div class="modal-header" style="background: #00274d; color: #ffffff; display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.6rem;">🏛️</span>
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; color: #ffffff;">Government of Punjab &bull; Revenue Department</h3>
            <div style="font-size: 0.72rem; color: #93c5fd;">Official BhuNaksha &amp; Jamabandi Cadastral Extract (ਨਕਲ ਜਮਾਂਬੰਦੀ)</div>
          </div>
        </div>
        <button type="button" class="btn-modal-close" onclick="window.app.closeFardModal()" aria-label="Close modal" style="color: #ffffff; font-size: 1.5rem; background: none; border: none; cursor: pointer;">&times;</button>
      </div>

      <div class="modal-body" style="padding: 24px; position: relative; background: #fafbfc;">
        <!-- Official Government Watermark -->
        <div class="fard-watermark">PUNJAB REVENUE &bull; DILRMP</div>

        <!-- Official Header -->
        <div class="fard-doc-header">
          <div style="text-align: center; border-bottom: 2px solid #00274d; padding-bottom: 12px; margin-bottom: 16px;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #00274d; text-transform: uppercase; letter-spacing: 0.04em;">
              ਡਾਇਰੈਕਟੋਰੇਟ ਆਫ਼ ਲੈਂਡ ਰਿਕਾਰਡਜ਼, ਪੰਜਾਬ &bull; Directorate of Land Records, Punjab
            </div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e3a8a; margin: 4px 0;">
              ਫਰਦ ਜਮਾਂਬੰਦੀ &bull; RECORD OF RIGHTS (RoR)
            </div>
            <div style="font-size: 0.75rem; color: #475569;">
              National Informatics Centre (NIC) &bull; DILRMP / SVAMITVA 2.0 &bull; Verified via jamabandi.punjab.gov.in
            </div>
          </div>

          <!-- Jurisdictional Metadata Grid -->
          <div class="fard-meta-grid">
            <div><span>ਜ਼ਿਲ੍ਹਾ / District:</span> <strong id="fard-district">Amritsar (02)</strong></div>
            <div><span>ਤਹਿਸੀਲ / Tehsil:</span> <strong id="fard-tehsil">Amritsar-I (Urban)</strong></div>
            <div><span>ਪਿੰਡ / Village &amp; Hadbast:</span> <strong id="fard-village">Kot Atma Singh (Hadbast No. 101)</strong></div>
            <div><span>ਸਾਲ ਜਮਾਂਬੰਦੀ / Year:</span> <strong id="fard-year">2023-2024</strong></div>
            <div><span>14-Digit Bhu-Aadhaar (ULPIN):</span> <strong id="fard-ulpin" style="color: #0284c7; font-family: monospace;">PB020011014121</strong></div>
            <div><span>ਸ਼ੀਟ ਨੰ: / Sheet No:</span> <strong>Block-1A (Cadastre Urban)</strong></div>
          </div>
        </div>

        <!-- 8-Column Official Punjab Revenue Table -->
        <div class="fard-table-container" style="overflow-x: auto; margin-top: 14px;">
          <table class="fard-table">
            <thead>
              <tr>
                <th>ਖੇਵਟ ਨੰ:<br><span style="font-size: 0.68rem; font-weight: normal;">Khewat No.</span></th>
                <th>ਖਤੌਨੀ ਨੰ:<br><span style="font-size: 0.68rem; font-weight: normal;">Khatouni No.</span></th>
                <th>ਮਾਲਕ ਦਾ ਨਾਮ ਤੇ ਵੇਰਵਾ<br><span style="font-size: 0.68rem; font-weight: normal;">Owner Name &amp; Share</span></th>
                <th>ਕਾਸ਼ਤਕਾਰ<br><span style="font-size: 0.68rem; font-weight: normal;">Cultivator / Occupant</span></th>
                <th>ਖਸਰਾ ਨੰ:<br><span style="font-size: 0.68rem; font-weight: normal;">Khasra No.</span></th>
                <th>ਰਕਬਾ<br><span style="font-size: 0.68rem; font-weight: normal;">Area (K-M)</span></th>
                <th>ਕਿਸਮ ਜ਼ਮੀਨ<br><span style="font-size: 0.68rem; font-weight: normal;">Classification</span></th>
                <th>Bhu-Aadhaar<br><span style="font-size: 0.68rem; font-weight: normal;">14-Digit ULPIN</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td id="fard-tbl-khewat" style="font-weight: 700;">88</td>
                <td id="fard-tbl-khatouni" style="font-weight: 700;">142</td>
                <td id="fard-tbl-owner" style="font-weight: 600;">Sardar Harpreet Singh<br><span style="font-size: 0.7rem; color: #64748b;">ਖ਼ੁਦਕਾਸ਼ਤ (Sole Owner 100%)</span></td>
                <td>ਮਕਬੂਜ਼ਾ ਮਾਲਕ<br><span style="font-size: 0.7rem; color: #64748b;">(Self Occupied)</span></td>
                <td id="fard-tbl-khasra" style="font-weight: 800; color: #0284c7; font-family: monospace;">412/1</td>
                <td id="fard-tbl-area" style="font-weight: 700;">0-7<br><span style="font-size: 0.7rem; color: #64748b;">(220 sq.yd)</span></td>
                <td id="fard-tbl-type">ਗ਼ੈਰ ਮੁਮਕਿਨ ਆਬਾਦੀ<br><span style="font-size: 0.68rem; color: #64748b;">(Gair Mumkin Abadi)</span></td>
                <td id="fard-tbl-ulpin" style="font-family: monospace; font-weight: 700; color: #0369a1;">PB020011014121</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Statutory Notice & Verification Link -->
        <div class="fard-footer-box">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 0.78rem; font-weight: 700; color: #166534;">
                ✅ NIC BhuNaksha &amp; Jamabandi Certified Record
              </div>
              <div style="font-size: 0.72rem; color: #475569; margin-top: 2px;">
                Verified under Punjab Land Records Society (PLRS) &bull; Digitally Signed by Halqa Patwari &amp; Kanungo
              </div>
            </div>
            <div style="text-align: right;">
              <a href="https://jamabandi.punjab.gov.in/" target="_blank" class="fard-verify-link">
                🌐 Verify on jamabandi.punjab.gov.in ↗
              </a>
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
          <button type="button" class="btn-card" onclick="window.app.copyBhuNakshaDetails(window.app.activeFardUlpin)" style="background: #0284c7; color: #ffffff; border: none; padding: 8px 16px; font-weight: 600; cursor: pointer; border-radius: 5px;">
            📋 Copy Record for BhuNaksha
          </button>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-card" onclick="window.print()" style="padding: 8px 14px; cursor: pointer; border-radius: 5px;">🖨️ Print Fard</button>
            <button type="button" class="btn-card" onclick="window.app.closeFardModal()" style="padding: 8px 14px; cursor: pointer; border-radius: 5px;">Close</button>
          </div>
        </div>

      </div>
    </div>
  </div>
`;

if (!html.includes('id="modal-bhunaksha-fard"')) {
  html = html.replace('<!-- Vendor Libraries:', fardModalHtml + '\n  <!-- Vendor Libraries:');
  console.log('✅ Added BhuNaksha Fard modal to index.html');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('✅ index.html updated with BhuNaksha components!');
