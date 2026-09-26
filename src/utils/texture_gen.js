// Procedural Photorealistic Architectural and Geological Texture Generator
export function createFacadeTexture(isFlagged = false, floorIndex = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base Wall Material (Modern Urban Sandstone / Textured Render)
  ctx.fillStyle = isFlagged ? '#4a151b' : (floorIndex === 0 ? '#cbd5e1' : '#f1f5f9');
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle surface noise / texture
  ctx.fillStyle = isFlagged ? 'rgba(255, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  for (let i = 0; i < 6000; i++) {
    const rx = Math.random() * canvas.width;
    const ry = Math.random() * canvas.height;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Horizontal architectural panel grooves / cornices
  ctx.fillStyle = isFlagged ? '#2a0c10' : '#94a3b8';
  ctx.fillRect(0, 0, canvas.width, 16);
  ctx.fillRect(0, canvas.height - 18, canvas.width, 18);

  // Balcony railings / glass parapet if upper floors
  if (floorIndex > 0) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(0, canvas.height - 120, canvas.width, 100);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, canvas.height - 120, canvas.width, 100);
  }

  // Row of Realistic Windows
  const windowCount = 5;
  const winWidth = 120;
  const winHeight = 220;
  const spacing = (canvas.width - (windowCount * winWidth)) / (windowCount + 1);
  const winY = 110;

  for (let w = 0; w < windowCount; w++) {
    const winX = spacing + w * (winWidth + spacing);

    // Dark Aluminum Window Frame
    ctx.fillStyle = isFlagged ? '#ef4444' : '#1e293b';
    ctx.fillRect(winX - 6, winY - 6, winWidth + 12, winHeight + 12);

    // Window Sill
    ctx.fillStyle = '#64748b';
    ctx.fillRect(winX - 12, winY + winHeight + 4, winWidth + 24, 14);

    // Window Glass Gradient (Sky Reflection)
    const glassGrad = ctx.createLinearGradient(winX, winY, winX + winWidth, winY + winHeight);
    if (isFlagged) {
      glassGrad.addColorStop(0, '#f87171');
      glassGrad.addColorStop(0.5, '#7f1d1d');
      glassGrad.addColorStop(1, '#dc2626');
    } else {
      glassGrad.addColorStop(0, '#bae6fd');
      glassGrad.addColorStop(0.3, '#38bdf8');
      glassGrad.addColorStop(0.7, '#0284c7');
      glassGrad.addColorStop(1, '#0c4a6e');
    }
    ctx.fillStyle = glassGrad;
    ctx.fillRect(winX, winY, winWidth, winHeight);

    // Modern Mullion / Window Panes
    ctx.strokeStyle = isFlagged ? '#991b1b' : '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Vertical pane divider
    ctx.moveTo(winX + winWidth / 2, winY);
    ctx.lineTo(winX + winWidth / 2, winY + winHeight);
    // Horizontal transom divider
    ctx.moveTo(winX, winY + winHeight * 0.35);
    ctx.lineTo(winX + winWidth, winY + winHeight * 0.35);
    ctx.stroke();

    // Glass Diagonal Reflection Glare
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(winX + 15, winY);
    ctx.lineTo(winX + 65, winY);
    ctx.lineTo(winX + 15, winY + winHeight);
    ctx.lineTo(winX - 35, winY + winHeight);
    ctx.fill();
  }

  // Flagged warning overlay if unauthorized level
  if (isFlagged) {
    ctx.fillStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 12;
    for (let i = -canvas.height; i < canvas.width; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 60, canvas.height);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createRooftopTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Waterproof Roof Tiles (Terracotta / Light Grey)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  // Grid of tiles
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Solar Photovoltaic Panels Array
  const solarX = 40;
  const solarY = 40;
  const solarW = 220;
  const solarH = 140;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(solarX - 4, solarY - 4, solarW + 8, solarH + 8);

  const solarGrad = ctx.createLinearGradient(solarX, solarY, solarX + solarW, solarY + solarH);
  solarGrad.addColorStop(0, '#1e3a8a');
  solarGrad.addColorStop(0.5, '#2563eb');
  solarGrad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = solarGrad;
  ctx.fillRect(solarX, solarY, solarW, solarH);

  // Solar cell grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  for (let sx = solarX; sx <= solarX + solarW; sx += 24) {
    ctx.beginPath();
    ctx.moveTo(sx, solarY);
    ctx.lineTo(sx, solarY + solarH);
    ctx.stroke();
  }
  for (let sy = solarY; sy <= solarY + solarH; sy += 20) {
    ctx.beginPath();
    ctx.moveTo(solarX, sy);
    ctx.lineTo(solarX + solarW, sy);
    ctx.stroke();
  }

  // Water Tank Base Pad
  ctx.fillStyle = '#64748b';
  ctx.fillRect(320, 60, 140, 140);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createSoilStrataTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Layer 1: Topsoil (0 to -8 ft)
  const topGrad = ctx.createLinearGradient(0, 0, 0, 250);
  topGrad.addColorStop(0, '#3e2723');
  topGrad.addColorStop(1, '#5d4037');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 512, 250);

  // Layer 2: Sandy Loam & Gravel Sediment (-8 ft to -18 ft)
  const midGrad = ctx.createLinearGradient(0, 250, 0, 600);
  midGrad.addColorStop(0, '#795548');
  midGrad.addColorStop(0.5, '#8d6e63');
  midGrad.addColorStop(1, '#6d4c41');
  ctx.fillStyle = midGrad;
  ctx.fillRect(0, 250, 512, 350);

  // Layer 3: Dense Sandstone & Bedrock (-18 ft to -30 ft)
  const deepGrad = ctx.createLinearGradient(0, 600, 0, 1024);
  deepGrad.addColorStop(0, '#37474f');
  deepGrad.addColorStop(0.5, '#455a64');
  deepGrad.addColorStop(1, '#263238');
  ctx.fillStyle = deepGrad;
  ctx.fillRect(0, 600, 512, 424);

  // Soil grain texture
  for (let i = 0; i < 8000; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 1024;
    ctx.fillStyle = py < 250 ? 'rgba(0,0,0,0.2)' : (py < 600 ? 'rgba(255,235,59,0.1)' : 'rgba(255,255,255,0.15)');
    ctx.fillRect(px, py, 2, 2);
  }

  // Depth Measurement Callout Markers on Edge
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('▼ GROUND LEVEL 0 FT (0.0m)', 24, 40);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 270);
  ctx.lineTo(500, 270);
  ctx.stroke();
  ctx.fillText('▼ UTILITY TRENCH -10 FT (-3.0m)', 24, 260);

  ctx.beginPath();
  ctx.moveTo(10, 620);
  ctx.lineTo(500, 620);
  ctx.stroke();
  ctx.fillText('▼ SEWER/GAS DEPTH -20 FT (-6.0m)', 24, 610);

  ctx.beginPath();
  ctx.moveTo(10, 980);
  ctx.lineTo(500, 980);
  ctx.stroke();
  ctx.fillText('▼ BEDROCK PILE BASE -30 FT (-9.14m)', 24, 970);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createBlueprintFloorTexture(floorName = "LEVEL 1 - RESIDENTIAL UNIT") {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // CAD Blueprint Architectural White Paper
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle Engineering Grey Grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Major Structural Walls (Sharp Dark Charcoal / Slate Grey CAD Lines)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, 944, 944);

  // Internal Room Partitions (Deep Slate Grey)
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  // Corridor divider
  ctx.beginPath();
  ctx.moveTo(40, 400);
  ctx.lineTo(984, 400);
  // Room vertical dividers
  ctx.moveTo(480, 40);
  ctx.lineTo(480, 400);
  ctx.moveTo(350, 400);
  ctx.lineTo(350, 984);
  ctx.moveTo(700, 400);
  ctx.lineTo(700, 984);
  ctx.stroke();

  // Architectural Door Swings (Quarter Circles - Mid Grey Dashed)
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 6]);
  // Door 1
  ctx.beginPath();
  ctx.arc(440, 400, 60, 0, Math.PI / 2);
  ctx.stroke();
  // Door 2
  ctx.beginPath();
  ctx.arc(350, 480, 60, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Architectural Room Labels & Dimensions (Dark Slate Grey Typography)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('MASTER BEDROOM (14\' x 16\')', 80, 160);
  ctx.fillText('LIVING & DINING (24\' x 18\')', 420, 680);
  ctx.fillText('KITCHEN (10\' x 12\')', 80, 680);
  ctx.fillText('BALCONY (DECK)', 760, 680);

  // Dimension Annotation Lines
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(80, 180); ctx.lineTo(380, 180);
  ctx.moveTo(420, 700); ctx.lineTo(740, 700);
  ctx.stroke();
  ctx.setLineDash([]);

  // Title Block (Clean Architectural Grey Box)
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(600, 840, 360, 120);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(floorName, 620, 878);
  ctx.fillStyle = '#475569';
  ctx.font = '15px monospace';
  ctx.fillText('SCALE: 1:100 | BIM LOD-350 ARCHITECTURAL', 620, 910);
  ctx.fillText('WHITE & GREY DAYTIME DRAFTING CAD', 620, 935);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
