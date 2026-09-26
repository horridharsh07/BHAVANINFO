const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'src', 'styles', 'gov-theme.css');
let css = fs.readFileSync(cssPath, 'utf8');

const newStyles = `
/* ==========================================================================
   OFFICIAL PUNJAB BHUNAKSHA & JAMABANDI RECORD OF RIGHTS (FARD) STYLING
   ========================================================================== */
.fard-modal-card {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  border: 1px solid #cbd5e1;
}

.fard-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-25deg);
  font-size: 3.5rem;
  font-weight: 900;
  color: rgba(15, 23, 42, 0.04);
  letter-spacing: 0.15em;
  pointer-events: none;
  text-transform: uppercase;
  white-space: nowrap;
  user-select: none;
}

.fard-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 14px;
  background: #f1f5f9;
  padding: 12px 14px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  font-size: 0.78rem;
}

.fard-meta-grid span {
  color: #64748b;
  display: block;
  font-size: 0.7rem;
}

.fard-meta-grid strong {
  color: #0f172a;
}

.fard-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
  text-align: left;
  border: 1px solid #cbd5e1;
  background: #ffffff;
}

.fard-table th {
  background: #e2e8f0;
  color: #1e293b;
  padding: 8px 6px;
  border: 1px solid #cbd5e1;
  font-weight: 700;
  line-height: 1.3;
}

.fard-table td {
  padding: 8px 6px;
  border: 1px solid #e2e8f0;
  color: #334155;
  vertical-align: top;
}

.fard-footer-box {
  margin-top: 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 10px 14px;
}

.fard-verify-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #166534;
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.15s ease;
}

.fard-verify-link:hover {
  background: #15803d;
}

.hud-bhunaksha-banner {
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 5px;
  padding: 5px 8px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.72rem;
  font-weight: 600;
  color: #0284c7;
}

.hud-btn-copy {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.hud-btn-copy:hover {
  background: #0369a1;
}

.bhunaksha-sync-card {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.toast-notification {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  color: #ffffff;
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid #38bdf8;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  font-size: 0.85rem;
  font-weight: 600;
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes toastIn {
  from { opacity: 0; transform: translate(-50%, 15px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
`;

if (!css.includes('fard-modal-card')) {
  css += newStyles;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('✅ Appended BhuNaksha Fard styles to gov-theme.css');
} else {
  console.log('Styles already present.');
}
