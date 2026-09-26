const fs = require('fs');
const path = require('path');

function search(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== '.system_generated') {
        search(full);
      }
    } else if (entry.isFile() && (full.endsWith('.js') || full.endsWith('.html'))) {
      if (full.includes('vendor') || full.includes('streets-gl') || full.includes('bundle')) continue;
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('level_tab') || line.includes('level-tab') || line.includes('level_code') || line.includes('levelCode')) {
          console.log(`${path.relative('d:/BHAVANINFO', full)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

search('d:/BHAVANINFO');
