const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'src', 'styles', 'gov-theme.css');
let css = fs.readFileSync(cssPath, 'utf8');

const newStyles = `
/* ==========================================================================
   BHU-AADHAAR 14-DIGIT STATUTORY ULPIN DECODER COMPONENT
   ========================================================================== */
.ulpin-decoder-wrap {
  margin-top: 8px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

.ulpin-decoder-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #38bdf8;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.ulpin-segment-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr 1.2fr 1.6fr;
  gap: 4px;
  margin-bottom: 6px;
}

.ulpin-seg-box {
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  padding: 4px 2px;
  text-align: center;
  transition: all 0.15s ease;
}

.ulpin-seg-box:hover {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
}

.ulpin-seg-box.highlight {
  border-color: rgba(245, 158, 11, 0.6);
  background: rgba(245, 158, 11, 0.12);
}

.ulpin-seg-box .seg-code {
  display: block;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.88rem;
  font-weight: 800;
  color: #f8fafc;
  line-height: 1.1;
  letter-spacing: 0.04em;
}

.ulpin-seg-box.highlight .seg-code {
  color: #fde047;
}

.ulpin-seg-box .seg-label {
  display: block;
  font-size: 0.6rem;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
  margin-top: 2px;
}

.ulpin-breakdown-details {
  border-top: 1px dashed rgba(148, 163, 184, 0.2);
  padding-top: 5px;
}

.bhu-aadhaar-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.bhu-pill {
  font-size: 0.65rem;
  font-weight: 600;
  background: rgba(14, 165, 233, 0.15);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.bhu-pill.plot-pill {
  background: rgba(245, 158, 11, 0.15);
  color: #fde047;
  border-color: rgba(245, 158, 11, 0.4);
  font-weight: 700;
}
`;

if (!css.includes('ulpin-decoder-wrap')) {
  css += newStyles;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('✅ Appended ULPIN decoder styles to gov-theme.css');
} else {
  console.log('Styles already present.');
}
