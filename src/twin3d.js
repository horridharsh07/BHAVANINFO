// Photorealistic 3D Digital Twin & BIM Blueprint Engine (Three.js WebGL + Real Boundary Extrusion)
import { 
  createFacadeTexture, 
  createRooftopTexture, 
  createSoilStrataTexture, 
  createBlueprintFloorTexture 
} from './utils/texture_gen.js';

export class DigitalTwin3D {
  constructor(containerId, onSelectLevel) {
    this.container = document.getElementById(containerId);
    this.onSelectLevel = onSelectLevel;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.buildingGroup = null;
    this.dimensionLinesGroup = null;
    this.selectionBracketGroup = null;
    this.groundMesh = null;
    this.subterraneanMode = false;
    this.fiberPulsePhase = 0;
    this.animatedPulseObjects = [];
    this.floorMeshes = [];
    this.currentParcel = null;
    this.explodeFactor = 0;
    this.viewMode = 'textured'; // 'textured' or 'blueprint'
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoverTag = document.getElementById('sub-ulpin-hover-tag');
    this.hoveredFloor = null;
    this.selectedLevelCode = null;
    
    this.animationFrameId = null;
  }

  init() {
    if (this.renderer) return;

    const width = this.container.clientWidth || Math.max(window.innerWidth - 440, 600);
    const height = this.container.clientHeight || Math.max(window.innerHeight - 120, 500);

    // Scene - Sharp, Dynamic High-Tech Grey & Black Cadastre Studio
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d16); // Sleek deep grey/black
    this.scene.fog = new THREE.Fog(0x090d16, 120, 650); // Sharp atmospheric depth

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 4000);
    this.camera.position.set(32, 28, 42);

    // High-Fidelity Renderer with Tone Mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls with complete 360 vertical underside & subterranean inspection support
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI - 0.05; // Full orbit underneath ground plane to inspect deep foundation and tunnels!
    this.controls.minPolarAngle = 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1500; // Unrestricted zoom-out for broad inspection
    this.controls.target.set(0, 5, 0);

    // High-Contrast Dynamic Lighting Setup
    // 1. Direct Sun Key Light
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(45, 75, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 180;
    sunLight.shadow.camera.left = -35;
    sunLight.shadow.camera.right = 35;
    sunLight.shadow.camera.top = 35;
    sunLight.shadow.camera.bottom = -35;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);

    // 2. High-Tech Dynamic Sky Hemisphere Light (Electric cyan sky, deep black bounce)
    const skyLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 1.25);
    this.scene.add(skyLight);

    // 3. Dynamic Electric Cyan Rim Light (Sharp edge highlights on building structure)
    const rimLight = new THREE.DirectionalLight(0x00f2fe, 1.35);
    rimLight.position.set(-35, 30, -35);
    this.scene.add(rimLight);

    // 4. Studio Fill Light
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.7);
    this.scene.add(ambientLight);

    // 5. Subterranean Dedicated Fill Light (illuminates underground foundation piles and utility tunnels)
    const subLight = new THREE.DirectionalLight(0x0284c7, 1.5);
    subLight.position.set(20, -30, 20);
    this.scene.add(subLight);

    // Environment Ground Pedestal
    this.buildSurroundingPedestal();

    // Event Listeners
    this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.container.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('resize', () => this.onResize());

    if (window.ResizeObserver && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(this.container);
    }

    this.animate();
  }

  buildSurroundingPedestal() {
    this.pedestalGroup = new THREE.Group();
    this.scene.add(this.pedestalGroup);

    // Initial Base Ground Texture Canvas (Sharp High-Tech Grey & Black Cadastre Radar Grid)
    const initCanvas = document.createElement('canvas');
    initCanvas.width = 512;
    initCanvas.height = 512;
    const ctx = initCanvas.getContext('2d');
    ctx.fillStyle = '#090e17'; // Deep dark grey/black
    ctx.fillRect(0, 0, 512, 512);

    // Sharp Dynamic Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 0; y < 512; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }

    // Dynamic Electric Cyan Major Axis Lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();

    const groundTex = new THREE.CanvasTexture(initCanvas);
    groundTex.wrapS = THREE.ClampToEdgeWrapping;
    groundTex.wrapT = THREE.ClampToEdgeWrapping;

    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.65,
      metalness: 0.15,
      transparent: false,
      opacity: 1.0,
      depthWrite: true
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    this.groundMesh = groundMesh;
    this.pedestalGroup.add(groundMesh);

    // 2. High-Tech Cadastre Inspection Concentric Rings (Sharp Cyan Glow)
    const ringGeo = new THREE.RingGeometry(28, 65, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      side: THREE.DoubleSide,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.02;
    this.pedestalGroup.add(ring);

    // Subterranean Depth Grid
    const subGrid = new THREE.GridHelper(80, 40, 0x0284c7, 0x1e293b);
    subGrid.position.y = -9.14;
    this.pedestalGroup.add(subGrid);
  }

  updateGroundSatelliteTexture(footprint, parcel) {
    if (!this.groundMesh || !footprint) return;

    let centerLon = footprint.centerLon;
    let centerLat = footprint.centerLat;

    if (!centerLon || !centerLat) {
      if (parcel?.centroid) {
        const c = Array.isArray(parcel.centroid) ? parcel.centroid : (typeof parcel.centroid === 'string' ? JSON.parse(parcel.centroid) : null);
        if (c) {
          if (c[0] > 60) { centerLon = Number(c[0]); centerLat = Number(c[1]); }
          else { centerLat = Number(c[0]); centerLon = Number(c[1]); }
        }
      }
    }

    if (!centerLon || !centerLat) {
      centerLon = 74.8599;
      centerLat = 31.6103;
    }

    const zoom = 18; // Calibrated zoom 18 guarantees authentic high-resolution satellite photography across all Punjab cities
    const latRad = (centerLat * Math.PI) / 180;
    const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);

    // Canvas size: 768x768 gives ~390m real aerial context around the building
    const canvasSize = 768;
    const halfCanvas = canvasSize / 2;
    const groundExtentMeters = canvasSize * metersPerPixel;

    // Resize ground mesh geometry to match the exact physical meter coverage of the canvas!
    if (this.groundMesh.geometry) this.groundMesh.geometry.dispose();
    this.groundMesh.geometry = new THREE.PlaneGeometry(groundExtentMeters, groundExtentMeters);

    // Global Web Mercator pixel coordinates of building center
    const worldX = ((centerLon + 180) / 360) * Math.pow(2, zoom) * 256;
    const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom) * 256;

    const centerTileX = Math.floor(worldX / 256);
    const centerTileY = Math.floor(worldY / 256);

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    // Sharp Dynamic Grey & Black Ground Base
    ctx.fillStyle = '#090e17';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Subtle CAD radar grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvasSize; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasSize); ctx.stroke();
    }
    for (let y = 0; y < canvasSize; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasSize, y); ctx.stroke();
    }

    // Dynamic Electric Cyan Axis
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(halfCanvas, 0); ctx.lineTo(halfCanvas, canvasSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, halfCanvas); ctx.lineTo(canvasSize, halfCanvas); ctx.stroke();

    const drawCadastralOverlay = () => {
      // Draw real Cadastral Boundary footprint in glowing electric gold on top of satellite imagery!
      if (footprint && footprint.localPoints && footprint.localPoints.length >= 3) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 215, 0, 1.0)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        footprint.localPoints.forEach((pt, idx) => {
          const px = halfCanvas + (pt.x / metersPerPixel);
          const py = halfCanvas + (pt.z / metersPerPixel);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.stroke();

        // Translucent cadastral parcel lot highlight
        ctx.fillStyle = 'rgba(0, 242, 254, 0.12)';
        ctx.fill();
        ctx.restore();
      }
    };

    // Draw initial boundary overlay immediately
    drawCadastralOverlay();

    const groundTex = new THREE.CanvasTexture(canvas);
    groundTex.wrapS = THREE.ClampToEdgeWrapping;
    groundTex.wrapT = THREE.ClampToEdgeWrapping;
    groundTex.needsUpdate = true;

    if (this.groundMesh.material.map) this.groundMesh.material.map.dispose();
    this.groundMesh.material.map = groundTex;
    this.groundMesh.material.transparent = false;
    this.groundMesh.material.opacity = 1.0;
    this.groundMesh.material.roughness = 0.6;
    this.groundMesh.material.metalness = 0.1;
    this.groundMesh.material.depthWrite = true;
    this.groundMesh.material.needsUpdate = true;

    // Fetch 3x3 ESRI World Imagery satellite tiles centered on this exact parcel
    const tilePromises = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = centerTileX + dx;
        const ty = centerTileY + dy;
        const tileOriginX = tx * 256;
        const tileOriginY = ty * 256;

        const posX = Math.round(halfCanvas + (tileOriginX - worldX));
        const posY = Math.round(halfCanvas + (tileOriginY - worldY));

        const proxyTileUrl = `/api/tiles/satellite/${zoom}/${ty}/${tx}`;
        const directTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;

        tilePromises.push(new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save();
            // Sharp, high-contrast dynamic aerial imagery filter
            ctx.filter = 'contrast(1.12) brightness(0.96)';
            ctx.drawImage(img, posX, posY, 256, 256);
            ctx.restore();
            resolve(true);
          };
          img.onerror = () => {
            // Direct ESRI fallback
            const fImg = new Image();
            fImg.crossOrigin = 'anonymous';
            fImg.onload = () => {
              ctx.save();
              ctx.filter = 'contrast(1.12) brightness(0.96)';
              ctx.drawImage(fImg, posX, posY, 256, 256);
              ctx.restore();
              resolve(true);
            };
            fImg.onerror = () => resolve(false);
            fImg.src = directTileUrl;
          };
          img.src = proxyTileUrl;
        }));
      }
    }

    Promise.all(tilePromises).then(() => {
      // Re-draw cadastral overlay crisp on top of downloaded aerial imagery
      drawCadastralOverlay();
      groundTex.needsUpdate = true;
      if (this.groundMesh?.material) {
        this.groundMesh.material.transparent = false;
        this.groundMesh.material.opacity = 1.0;
        this.groundMesh.material.needsUpdate = true;
      }
    });
  }

  syncGroundWithFootprint(footprint, parcel) {
    if (!footprint || !this.pedestalGroup) return;

    // 1. Fetch & composite real ESRI satellite aerial imagery matching this exact parcel
    this.updateGroundSatelliteTexture(footprint, parcel);

    // 2. Remove any previous cadastral boundary markers
    const oldBoundary = this.pedestalGroup.getObjectByName('cadastral-boundary-mesh');
    if (oldBoundary) this.pedestalGroup.remove(oldBoundary);

    const boundaryGroup = new THREE.Group();
    boundaryGroup.name = 'cadastral-boundary-mesh';

    // 3. Glowing Gold Cadastral Boundary Line on the ground matching exact footprint coordinates
    const boundaryPoints = [...footprint.localPoints, footprint.localPoints[0]].map(p => new THREE.Vector3(p.x, 0.05, p.z));
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      linewidth: 4,
      transparent: true,
      opacity: 0.95
    });
    const boundaryLine = new THREE.Line(boundaryGeo, boundaryMat);
    boundaryGroup.add(boundaryLine);

    // 4. Official Cadastre Corner Survey Monuments / Boundary Pillars (Pillars #1..N)
    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.8, 16);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0xb45309,
      emissiveIntensity: 0.3
    });

    footprint.localPoints.forEach((pt, pIdx) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(pt.x, 0.4, pt.z);
      pillar.castShadow = true;
      pillar.userData = {
        subterraneanUtility: {
          title: `🚩 Official Cadastral Boundary Monument #${pIdx + 1}`,
          code: `PB-CADASTRE-MONUMENT-P${pIdx + 1}`,
          desc: 'High-precision DGPS/CORS surveyed statutory boundary pillar marking legal property parcel boundary corner.',
          depth: 'Grade Level (0.00m)',
          dept: 'Survey of India & Punjab Land Records Society',
          badgeColor: '#ffd700'
        }
      };
      boundaryGroup.add(pillar);

      // Fluorescent warning cap on top of pillar
      const capGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.15, 12);
      const capMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(pt.x, 0.85, pt.z);
      boundaryGroup.add(cap);
    });

    this.pedestalGroup.add(boundaryGroup);
  }

  loadParcel(parcel) {
    this.currentParcel = parcel;
    this.selectedLevelCode = null;

    if (this.buildingGroup) {
      this.scene.remove(this.buildingGroup);
      this.buildingGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }

    if (this.dimensionLinesGroup) {
      this.scene.remove(this.dimensionLinesGroup);
    }

    if (this.pendingSurveyGroup) {
      this.scene.remove(this.pendingSurveyGroup);
      this.pendingSurveyGroup = null;
    }

    this.buildingGroup = new THREE.Group();
    this.dimensionLinesGroup = new THREE.Group();
    this.floorMeshes = [];

    // Calculate real 2D boundary footprint from parcel coordinates
    const footprint = this.computeFootprintFromCoordinates(parcel.coordinates);
    this.currentFootprint = footprint;
    const floorHeight = 3.3;

    // Synchronize ground map and official cadastral boundary markers with footprint
    this.syncGroundWithFootprint(footprint, parcel);

    // Check if parcel is pending autonomous drone survey
    const isPending = (parcel.status === 'PENDING_REGISTRATION' || parcel.status === 'PENDING' || parcel.is_pending);

    if (isPending) {
      // Build Authentic Pending Cadastral Drone Survey Scene (DO NOT show blueprint)
      this.buildPendingDroneSurveyScene(footprint, parcel);
      this.scene.add(this.pendingSurveyGroup);
      this.showPendingSurveyOverlay(parcel);

      // Focus camera on ground demarcation & hovering drone
      this.controls.target.set(0, 4.5, 0);
      this.controls.update();
      return;
    }

    // Otherwise (Digitalized / Flagged): Hide pending overlay and build full 3D architectural twin
    this.hidePendingSurveyOverlay();

    // Ensure levels array is valid
    let levels = parcel.levels;
    if (!levels || levels.length < 1) {
      levels = this.generateDefaultLevelsForParcel(parcel);
      parcel.levels = levels;
    }

    let aboveGroundIndex = 0;
    levels.forEach((lvl, idx) => {
      const levelGroup = new THREE.Group();
      levelGroup.userData = { levelData: lvl, initialY: 0 };

      if (lvl.is_subterranean) {
        // -30ft Subterranean Soil & Multi-Utility Layer
        this.buildRealisticSubterraneanLevel(levelGroup, footprint, lvl);
        levelGroup.userData.initialY = -4.6;
        levelGroup.userData.floorIndex = -1;
      } else {
        // Upper Levels (Ground Floor starts at Y=0, Floor 1 at Y=3.3, Floor 2 at Y=6.6, etc.)
        const floorIndex = aboveGroundIndex;
        aboveGroundIndex++;

        const baseFloorY = floorIndex * floorHeight;
        levelGroup.userData.initialY = baseFloorY;
        levelGroup.userData.floorIndex = floorIndex;

        const isTopFloor = (idx === levels.length - 1);
        this.buildPhotorealisticFloor(levelGroup, footprint, floorHeight, lvl, floorIndex, isTopFloor);
      }

      levelGroup.position.y = levelGroup.userData.initialY;
      levelGroup.visible = true;
      this.buildingGroup.add(levelGroup);
      this.floorMeshes.push(levelGroup);
    });

    // Build 3D CAD Architectural Dimension Lines
    this.buildDimensionLines(footprint);
    this.scene.add(this.dimensionLinesGroup);

    this.scene.add(this.buildingGroup);

    // Center & frame camera on building in true 1:1 metric scale
    const maxDim = Math.max(footprint.width, footprint.length, 16);
    const totalAboveHeight = Math.max(1, aboveGroundIndex) * floorHeight;
    const camDist = Math.max(22, maxDim * 1.5);
    this.camera.position.set(camDist * 0.85, totalAboveHeight * 0.6 + camDist * 0.65, camDist * 1.1);
    this.controls.target.set(0, totalAboveHeight / 2, 0);
    this.controls.update();
  }

  buildPendingDroneSurveyScene(footprint, parcel) {
    if (this.pendingSurveyGroup) {
      this.scene.remove(this.pendingSurveyGroup);
      this.pendingSurveyGroup = null;
    }

    this.pendingSurveyGroup = new THREE.Group();
    this.dronePropellers = [];

    // 1. Demarcated Boundary Line on Ground (Glowing Amber Dash)
    const boundaryPoints = [...footprint.localPoints, footprint.localPoints[0]].map(p => new THREE.Vector3(p.x, 0.08, p.z));
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
    const boundaryMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.8,
      gapSize: 0.4,
      linewidth: 3
    });
    const boundaryLine = new THREE.Line(boundaryGeo, boundaryMat);
    boundaryLine.computeLineDistances();
    this.pendingSurveyGroup.add(boundaryLine);

    // 2. Corner Demarcation Survey Pegs / Flags
    footprint.localPoints.forEach((pt, idx) => {
      const pegGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.8, 8);
      const pegMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });
      const peg = new THREE.Mesh(pegGeo, pegMat);
      peg.position.set(pt.x, 0.9, pt.z);
      this.pendingSurveyGroup.add(peg);

      // Warning Survey Flag on Peg
      const flagGeo = new THREE.BoxGeometry(0.5, 0.3, 0.05);
      const flagMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(pt.x + 0.25, 1.65, pt.z);
      this.pendingSurveyGroup.add(flag);
    });

    // 3. Ground Grid Demarcation Plane
    const groundGrid = new THREE.GridHelper(footprint.width * 1.5, 20, 0xf59e0b, 0x1e3a8a);
    groundGrid.position.y = 0.02;
    this.pendingSurveyGroup.add(groundGrid);

    // 4. Drone Model Hovering in Center
    const drone = new THREE.Group();
    this.droneBaseY = 10.5;
    drone.position.set(0, this.droneBaseY, 0);

    // Central Fuselage
    const bodyGeo = new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    drone.add(body);

    // Drone Top Shell
    const topDomeGeo = new THREE.SphereGeometry(0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const topDomeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.3 });
    const topDome = new THREE.Mesh(topDomeGeo, topDomeMat);
    topDome.position.y = 0.25;
    drone.add(topDome);

    // 4 Rotor Arms (X-configuration)
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });
    const armAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];

    armAngles.forEach((ang, idx) => {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = ang;
      drone.add(arm);

      const motorDist = 1.6;
      const mx = Math.cos(ang) * motorDist;
      const mz = Math.sin(ang) * motorDist;

      const motorGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.35, 12);
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const motor = new THREE.Mesh(motorGeo, motorMat);
      motor.position.set(mx, 0.15, mz);
      drone.add(motor);

      // Propeller (rotating rotor)
      const propGroup = new THREE.Group();
      propGroup.position.set(mx, 0.35, mz);

      const bladeGeo = new THREE.BoxGeometry(1.6, 0.02, 0.16);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3, roughness: 0.4 });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      propGroup.add(blade);

      drone.add(propGroup);
      this.dronePropellers.push(propGroup);

      // Nav LED lights
      const ledColor = (idx < 2) ? 0xef4444 : 0x10b981;
      const ledGeo = new THREE.SphereGeometry(0.09, 8, 8);
      const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(mx, -0.15, mz);
      drone.add(led);
    });

    // Downward LiDAR Scanner Emitter
    const lidarHeadGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.4, 12);
    const lidarHeadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const lidarHead = new THREE.Mesh(lidarHeadGeo, lidarHeadMat);
    lidarHead.position.y = -0.35;
    drone.add(lidarHead);

    // Downward LiDAR Scanning Laser Cone (Translucent Green)
    const coneGeo = new THREE.ConeGeometry(footprint.width * 0.7, 10.5, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const lidarCone = new THREE.Mesh(coneGeo, coneMat);
    lidarCone.position.y = -5.25;
    drone.add(lidarCone);
    this.lidarBeamMesh = lidarCone;

    this.droneMesh = drone;
    this.pendingSurveyGroup.add(drone);
  }

  showPendingSurveyOverlay(parcel) {
    const overlay = document.getElementById('twin-pending-survey-overlay');
    if (!overlay) return;

    const khasraEl = document.getElementById('pending-khasra-val');
    const ulpinEl = document.getElementById('pending-ulpin-val');
    const floorsEl = document.getElementById('pending-floors-val');
    const areaEl = document.getElementById('pending-area-val');

    if (khasraEl) khasraEl.textContent = parcel.survey_no || 'Khasra Demarcated';
    if (ulpinEl) ulpinEl.textContent = parcel.ulpin || 'BCN501B1NA2CH0';
    if (floorsEl) floorsEl.textContent = `${parcel.declared_floors || parcel.total_floors || 1} Levels Declared`;
    if (areaEl) areaEl.textContent = parcel.area_sqyd ? `${parcel.area_sqyd} sq.yd (${parcel.area_sqft || parcel.area_sqyd * 9} sq.ft)` : '385 sq.yd';

    const btnSim = document.getElementById('btn-trigger-drone-sim');
    const titleEl = document.getElementById('pending-survey-title');
    const descEl = document.getElementById('pending-survey-desc');
    const badgeEl = document.querySelector('#twin-pending-survey-overlay .pending-badge');

    if (parcel.drone_dispatched) {
      if (btnSim) {
        btnSim.disabled = true;
        btnSim.classList.add('dispatched');
        btnSim.style.background = '#15803d';
        btnSim.style.cursor = 'default';
        btnSim.innerHTML = `<span>✅</span> Autonomous Drone Survey Mission Queued at Municipal Depot`;
      }
      if (badgeEl) {
        badgeEl.textContent = '✅ DRONE SURVEY MISSION DISPATCHED & QUEUED';
        badgeEl.style.background = '#15803d';
      }
      if (titleEl) {
        titleEl.textContent = 'Mission #DRONE-PB02-2026-Q88 Queued at Municipal Depot';
        titleEl.style.color = '#15803d';
      }
      if (descEl) {
        descEl.innerHTML = `
          <div style="background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 6px; padding: 12px 14px; margin-top: 6px; color: #166534; font-size: 0.82rem; line-height: 1.5; text-align: left;">
            <strong style="color: #166534; font-size: 0.88rem;">✅ Autonomous Survey Mission Dispatched:</strong><br>
            Cadastral Drone LiDAR SLAM 3R survey flight mission <strong>#DRONE-PB02-2026-Q88</strong> has been registered with the Municipal Corporation Drone Depot under DGCA Green-Zone authorization. Flight operations will execute within the <strong>next two working days</strong>. Volumetric 3D point-cloud and Sub-ULPIN reconstruction will be processed post-flight.
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #86efac; font-size: 0.74rem; display: flex; justify-content: space-between;">
              <span>🗓️ Flight Window: Next 2 Working Days</span>
              <span>📍 Status: Queued in Depot</span>
            </div>
          </div>
        `;
      }
    } else {
      if (btnSim) {
        btnSim.disabled = false;
        btnSim.classList.remove('dispatched');
        btnSim.style.background = '';
        btnSim.style.cursor = 'pointer';
        btnSim.innerHTML = `<span>🚀</span> Start Drone LiDAR SLAM Survey`;
      }
      if (badgeEl) {
        badgeEl.textContent = '⏳ DRONE LiDAR SURVEY PENDING';
        badgeEl.style.background = '';
      }
      if (titleEl) {
        titleEl.textContent = 'Autonomous Drone SLAM 3R Survey Scheduled';
        titleEl.style.color = '';
      }
      if (descEl) {
        descEl.innerHTML = `No 3D Blueprint is available yet. An autonomous cadastral LiDAR drone survey is scheduled to execute within the <strong>next two working days</strong>.`;
      }
    }

    overlay.style.display = 'flex';
  }

  hidePendingSurveyOverlay() {
    const overlay = document.getElementById('twin-pending-survey-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  executeDroneScanSimulation(onComplete) {
    const btnSim = document.getElementById('btn-trigger-drone-sim');
    if (btnSim) {
      btnSim.disabled = true;
      btnSim.classList.add('dispatched');
      btnSim.style.background = '#15803d';
      btnSim.style.cursor = 'default';
      btnSim.innerHTML = `<span>✅</span> Autonomous Drone Survey Mission Queued at Municipal Depot`;
    }

    const titleEl = document.getElementById('pending-survey-title');
    const descEl = document.getElementById('pending-survey-desc');
    const badgeEl = document.querySelector('#twin-pending-survey-overlay .pending-badge');

    if (badgeEl) {
      badgeEl.textContent = '✅ DRONE SURVEY MISSION DISPATCHED & QUEUED';
      badgeEl.style.background = '#15803d';
    }
    if (titleEl) {
      titleEl.textContent = 'Mission #DRONE-PB02-2026-Q88 Queued at Municipal Depot';
      titleEl.style.color = '#15803d';
    }
    if (descEl) {
      descEl.innerHTML = `
        <div style="background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 6px; padding: 12px 14px; margin-top: 6px; color: #166534; font-size: 0.82rem; line-height: 1.5; text-align: left;">
          <strong style="color: #166534; font-size: 0.88rem;">✅ Autonomous Survey Mission Dispatched:</strong><br>
          Cadastral Drone LiDAR SLAM 3R survey flight mission <strong>#DRONE-PB02-2026-Q88</strong> has been registered with the Municipal Corporation Drone Depot under DGCA Green-Zone authorization. Flight operations will execute within the <strong>next two working days</strong>. Volumetric 3D point-cloud and Sub-ULPIN reconstruction will be processed post-flight.
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #86efac; font-size: 0.74rem; display: flex; justify-content: space-between;">
            <span>🗓️ Flight Window: Next 2 Working Days</span>
            <span>📍 Status: Queued in Depot</span>
          </div>
        </div>
      `;
    }

    if (onComplete) onComplete();
  }

  generateDefaultLevelsForParcel(parcel) {
    const rawFloors = parcel.total_floors !== undefined && parcel.total_floors !== null
      ? Number(parcel.total_floors)
      : (parcel.declared_floors || 1);
    const floors = Math.max(1, rawFloors);
    const ulpin = parcel.ulpin || 'BCN501B1NA2CH0';
    const owner = parcel.owner || 'Registered Owner';
    const isFlagged = !!parcel.has_anomaly;

    const levels = [];
    levels.push({
      level_code: 'B30',
      sub_ulpin: `${ulpin}-B30-UTL`,
      name: 'Subterranean Foundation (-30 ft / -9.14 m)',
      depth_feet: -30.0,
      is_subterranean: true,
      owner: 'Government / Municipal Corporation of Amritsar (MCA)',
      carpet_area_sqft: 1200,
      utilities: [
        { type: 'High Voltage Electric Conduits', color: '#ff3344', status: 'ACTIVE', meter: 'PSPCL-LT-8821' },
        { type: 'Municipal Water Line (Inlet)', color: '#00bbff', status: 'ACTIVE', meter: 'MCA-W-4102' },
        { type: 'Main Sewerage Outflow', color: '#cc7722', status: 'ACTIVE', meter: 'MCA-SEW-991' },
        { type: 'Piped Natural Gas (PNG)', color: '#eab308', status: 'ACTIVE', meter: 'MCA-GAS-332' },
        { type: 'Optical Fiber Telecom Trunk', color: '#10b981', status: 'ACTIVE', meter: 'BSNL-OFC-551' }
      ]
    });

    levels.push({
      level_code: 'G00',
      sub_ulpin: `${ulpin}-G00-LBY`,
      name: 'Ground Floor (Lobby & Stilt Parking)',
      height_m: 3.2,
      is_subterranean: false,
      owner: owner,
      carpet_area_sqft: 1150,
      tax_status: 'PAID',
      is_flagged: false
    });

    for (let f = 1; f < floors; f++) {
      const isFloorFlagged = isFlagged && (f === floors - 1);
      levels.push({
        level_code: `F0${f}`,
        sub_ulpin: `${ulpin}-F0${f}-U01`,
        name: `Level ${f} - ${isFloorFlagged ? 'Terrace Extension (Flagged)' : 'Residential Unit'}`,
        height_m: 3.0,
        is_subterranean: false,
        owner: owner,
        carpet_area_sqft: 1180 - f * 30,
        tax_status: isFloorFlagged ? 'PENDING_CHALLAN' : 'PAID',
        is_flagged: isFloorFlagged
      });
    }

    return levels;
  }

  computeFootprintFromCoordinates(coords) {
    if (!coords || coords.length < 3) {
      coords = [
        [74.8620, 31.6125],
        [74.8626, 31.6125],
        [74.8626, 31.6131],
        [74.8620, 31.6131]
      ];
    }

    // Filter duplicate closing point if present
    const uniqueCoords = [];
    for (let i = 0; i < coords.length; i++) {
      const isClosing = (i > 0 && i === coords.length - 1 && 
        Math.abs(coords[i][0] - coords[0][0]) < 1e-6 && 
        Math.abs(coords[i][1] - coords[0][1]) < 1e-6);
      if (!isClosing) {
        uniqueCoords.push(coords[i]);
      }
    }
    if (uniqueCoords.length < 3) uniqueCoords.push(...coords.slice(0, 3));

    // Convert GPS coordinates to local meters centered at 0,0
    const lons = uniqueCoords.map(c => c[0]);
    const lats = uniqueCoords.map(c => c[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const metersPerLat = 111320;
    const metersPerLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

    const localPoints = uniqueCoords.map(c => {
      const x = (c[0] - centerLon) * metersPerLon;
      const z = -(c[1] - centerLat) * metersPerLat; // North is -Z
      return { x, z };
    });

    // Compute bounding box dimensions
    const xs = localPoints.map(p => p.x);
    const zs = localPoints.map(p => p.z);
    const rawWidth = Math.max(...xs) - Math.min(...xs);
    const rawLength = Math.max(...zs) - Math.min(...zs);

    // True physical 1:1 metric scale (1 Three.js unit = 1 real-world meter)
    const scale = 1.0;

    const scaledPoints = localPoints.map(p => ({
      x: p.x * scale,
      z: p.z * scale
    }));

    // Construct exact THREE.Shape (mapping (x, -z) so rotateX(-PI/2) aligns with 3D (x, z))
    const shape = new THREE.Shape();
    shape.moveTo(scaledPoints[0].x, -scaledPoints[0].z);
    for (let i = 1; i < scaledPoints.length; i++) {
      shape.lineTo(scaledPoints[i].x, -scaledPoints[i].z);
    }
    shape.closePath();

    const width = rawWidth;
    const length = rawLength;

    // Calculate dominant orientation angle from longest perimeter edge
    let maxEdgeLen = 0;
    let dominantAngle = 0;
    for (let i = 0; i < scaledPoints.length; i++) {
      const p1 = scaledPoints[i];
      const p2 = scaledPoints[(i + 1) % scaledPoints.length];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dz);
      if (len > maxEdgeLen) {
        maxEdgeLen = len;
        dominantAngle = Math.atan2(dz, dx);
      }
    }

    return { 
      width, 
      length, 
      shape, 
      localPoints: scaledPoints, 
      rawWidth, 
      rawLength,
      centerLon,
      centerLat,
      metersPerLat,
      metersPerLon,
      dominantAngle
    };
  }

  buildPhotorealisticFloor(group, footprint, height, levelData, floorIndex, isTopFloor) {
    const isFlagged = levelData.is_flagged;
    const width = footprint.width;
    const length = footprint.length;

    // 1. Reinforced Concrete Floor Slab using EXACT polygon shape
    const slabThickness = 0.45;
    const slabGeo = new THREE.ExtrudeGeometry(footprint.shape, {
      depth: slabThickness,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.12,
      bevelThickness: 0.06
    });
    slabGeo.rotateX(-Math.PI / 2); // Lay horizontally in XZ, extruding upward in +Y

    const slabMat = new THREE.MeshStandardMaterial({
      color: isFlagged ? 0x991b1b : 0xe2e8f0,
      roughness: 0.7,
      metalness: 0.1
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.y = 0;
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.userData = { levelData, originalMat: slabMat };
    group.add(slab);

    // 2. Photorealistic Architectural Exterior Facade Walls using EXACT polygon shape
    const wallHeight = height - slabThickness;
    const wallGeo = new THREE.ExtrudeGeometry(footprint.shape, {
      depth: wallHeight,
      bevelEnabled: false
    });
    wallGeo.rotateX(-Math.PI / 2);

    const facadeTex = createFacadeTexture(isFlagged, floorIndex);
    const wallMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      roughness: 0.5,
      metalness: 0.15,
      emissive: isFlagged ? new THREE.Color(0xff0022) : new THREE.Color(0x000000),
      emissiveIntensity: isFlagged ? 0.45 : 0
    });
    const walls = new THREE.Mesh(wallGeo, wallMat);
    walls.position.y = slabThickness;
    walls.castShadow = true;
    walls.receiveShadow = true;
    walls.userData = { levelData, originalMat: wallMat };
    group.add(walls);

    // 3. Interior Blueprint Floor Plate using EXACT polygon shape
    const interiorFloorGeo = new THREE.ShapeGeometry(footprint.shape);
    interiorFloorGeo.rotateX(-Math.PI / 2);

    const blueprintTex = createBlueprintFloorTexture(levelData.name);
    const interiorMat = new THREE.MeshBasicMaterial({
      map: blueprintTex,
      side: THREE.DoubleSide
    });
    const interiorFloor = new THREE.Mesh(interiorFloorGeo, interiorMat);
    interiorFloor.position.y = slabThickness + 0.05;
    interiorFloor.userData = { levelData };
    group.add(interiorFloor);

    // 4. Structural Concrete Columns / Pillars on EVERY corner of the real building polygon!
    const colThickness = 0.55;
    const colGeo = new THREE.BoxGeometry(colThickness, wallHeight, colThickness);
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8,
      metalness: 0.2
    });

    footprint.localPoints.forEach((pt) => {
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(pt.x, slabThickness + wallHeight / 2, pt.z);
      colMesh.castShadow = true;
      colMesh.userData = { isStructure: true, originalMat: colMat, levelData };
      group.add(colMesh);
    });

    // 5. 3D Internal Architectural Partition Walls
    const intWallMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.6,
      metalness: 0.1
    });

    const wallH = height - slabThickness - 0.1;
    const partWall1 = new THREE.Mesh(new THREE.BoxGeometry(Math.max(4, width * 0.4), wallH, 0.22), intWallMat);
    partWall1.position.set(-width * 0.2, slabThickness + wallH / 2, -length * 0.08);
    partWall1.userData = { isInteriorWall: true, originalMat: intWallMat, levelData };
    group.add(partWall1);

    const partWall2 = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3, width * 0.3), wallH, 0.22), intWallMat);
    partWall2.position.set(width * 0.25, slabThickness + wallH / 2, -length * 0.08);
    partWall2.userData = { isInteriorWall: true, originalMat: intWallMat, levelData };
    group.add(partWall2);

    // 6. Rooftop Terrace Features (Water Tanks & Solar PV)
    if (isTopFloor) {
      this.buildRooftopStructures(group, footprint, height);
    }
  }

  buildRooftopStructures(group, footprint, floorHeight) {
    const roofY = floorHeight + 0.45;
    const width = footprint.width;
    const length = footprint.length;

    // Roof Parapet Wall following exact building polygon perimeter
    const parapetPoints = [...footprint.localPoints, footprint.localPoints[0]].map(p => new THREE.Vector3(p.x, roofY + 0.45, p.z));
    const parapetGeo = new THREE.BufferGeometry().setFromPoints(parapetPoints);
    const parapet = new THREE.Line(parapetGeo, new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 3 }));
    group.add(parapet);

    // Rooftop Surface Texture using exact polygon shape
    const roofPlateGeo = new THREE.ShapeGeometry(footprint.shape);
    roofPlateGeo.rotateX(-Math.PI / 2);

    const roofTex = createRooftopTexture();
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.7 });
    const roofPlate = new THREE.Mesh(roofPlateGeo, roofMat);
    roofPlate.position.y = roofY + 0.05;
    roofPlate.receiveShadow = true;
    group.add(roofPlate);

    // Compute dominant orientation angle and direction vectors
    const angle = footprint.dominantAngle || 0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const perpCos = -sinA;
    const perpSin = cosA;

    // Staircase Headroom Tower (ALIGNED with building wall angle!)
    const stairGeo = new THREE.BoxGeometry(3.2, 2.6, 3.2);
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
    const stairTower = new THREE.Mesh(stairGeo, stairMat);
    const stairOffset = -Math.min(width, length) * 0.2;
    stairTower.position.set(stairOffset * cosA, roofY + 1.3, stairOffset * sinA);
    stairTower.rotation.y = -angle;
    stairTower.castShadow = true;
    group.add(stairTower);

    // Dual Overhead Water Storage Tanks (ALIGNED with building axis!)
    const tankGeo = new THREE.CylinderGeometry(1.0, 1.0, 2.0, 16);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
    const tankOffset = Math.min(width, length) * 0.2;

    const tank1 = new THREE.Mesh(tankGeo, tankMat);
    tank1.position.set(tankOffset * cosA + 1.4 * perpCos, roofY + 1.45, tankOffset * sinA + 1.4 * perpSin);
    tank1.castShadow = true;
    group.add(tank1);

    const tank2 = new THREE.Mesh(tankGeo, tankMat);
    tank2.position.set(tankOffset * cosA - 1.2 * perpCos, roofY + 1.45, tankOffset * sinA - 1.2 * perpSin);
    tank2.castShadow = true;
    group.add(tank2);
  }

  buildRealisticSubterraneanLevel(group, footprint, levelData) {
    const width = Math.max(26, footprint.width + 10);
    const length = Math.max(26, footprint.length + 10);
    const depth = 11.5; // ~38 feet deep geological strata

    // 1. Geological Strata Soil Cross-Section Block
    const soilTex = createSoilStrataTexture();
    const soilGeo = new THREE.BoxGeometry(width, depth, length);
    const soilMat = new THREE.MeshStandardMaterial({
      map: soilTex,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.18, // Translucent architectural cutaway so underground pipes & cables are crystal clear!
      depthWrite: false
    });
    const soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.position.y = -depth / 2;
    soilMesh.receiveShadow = true;
    soilMesh.userData = { levelData, originalMat: soilMat };
    group.add(soilMesh);

    // 2. Groundwater Table Aquifer Horizon (Natural Water Plane at -6.8m)
    const waterTableGeo = new THREE.PlaneGeometry(width + 4, length + 4);
    const waterTableMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.22,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const waterTable = new THREE.Mesh(waterTableGeo, waterTableMat);
    waterTable.rotation.x = -Math.PI / 2;
    waterTable.position.y = -6.8;
    waterTable.userData = {
      subterraneanUtility: {
        title: '💧 Groundwater Aquifer Table',
        code: 'AQUIFER-HORIZON-PB02',
        desc: 'Unconfined alluvial sand aquifer. Static water table level -6.8m (-22.3 ft) below road grade.',
        depth: '-6.8m (-22.3 ft)',
        dept: 'Punjab Water Resources Dept / CGWA',
        badgeColor: '#38bdf8'
      }
    };
    group.add(waterTable);

    // 3. WALKABLE REINFORCED CONCRETE MULTI-UTILITY SERVICE TUNNEL (GALLERY)
    // Runs beneath the street alongside the parcel perimeter
    const tunnelZ = length / 2 - 3.2;
    const tunnelLen = width + 4;
    const tunnelW = 3.6;
    const tunnelH = 3.2;
    const tunnelY = -4.5;

    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      metalness: 0.2
    });

    // Tunnel Floor Slab
    const tFloor = new THREE.Mesh(new THREE.BoxGeometry(tunnelLen, 0.35, tunnelW), tunnelMat);
    tFloor.position.set(0, tunnelY - tunnelH / 2, tunnelZ);
    tFloor.receiveShadow = true;
    group.add(tFloor);

    // Tunnel Roof Slab
    const tRoof = new THREE.Mesh(new THREE.BoxGeometry(tunnelLen, 0.35, tunnelW), tunnelMat);
    tRoof.position.set(0, tunnelY + tunnelH / 2, tunnelZ);
    tRoof.castShadow = true;
    group.add(tRoof);

    // Tunnel Concrete Back Wall
    const tBackWall = new THREE.Mesh(new THREE.BoxGeometry(tunnelLen, tunnelH, 0.35), tunnelMat);
    tBackWall.position.set(0, tunnelY, tunnelZ + tunnelW / 2);
    tBackWall.receiveShadow = true;
    group.add(tBackWall);

    // Portal Entry Arches with Yellow/Black Safety Chevron Stripes
    [-tunnelLen / 2, tunnelLen / 2].forEach(px => {
      const portalGeo = new THREE.BoxGeometry(0.5, tunnelH, tunnelW);
      const portalMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5 });
      const portal = new THREE.Mesh(portalGeo, portalMat);
      portal.position.set(px, tunnelY, tunnelZ);
      group.add(portal);
    });

    // Galvanized Steel Grating Floor Walkway inside Tunnel
    const gratingMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.3,
      wireframe: true
    });
    const gratingMesh = new THREE.Mesh(new THREE.BoxGeometry(tunnelLen - 0.5, 0.08, tunnelW * 0.55), gratingMat);
    gratingMesh.position.set(0, tunnelY - tunnelH / 2 + 0.2, tunnelZ - 0.3);
    group.add(gratingMesh);

    // 4. WALL-MOUNTED 3-TIER CABLE LADDER TRAYS & BUNDLED CONDUITS
    // Cantilever support arms every 4 meters
    const supportMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    for (let sx = -tunnelLen / 2 + 2; sx <= tunnelLen / 2 - 2; sx += 4) {
      [-0.7, 0.0, 0.7].forEach(yOff => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.1), supportMat);
        arm.position.set(sx, tunnelY + yOff, tunnelZ + tunnelW / 2 - 0.55);
        group.add(arm);
      });
    }

    // TIER 1 (TOP, Y = -3.8m): High-Voltage 33kV/11kV Electrical Transmission Feeders
    const hvColors = [0xef4444, 0xfacc15, 0x3b82f6]; // Red, Yellow, Blue 3-Phase + Black Ground
    hvColors.forEach((col, cIdx) => {
      const cableGeo = new THREE.CylinderGeometry(0.11, 0.11, tunnelLen, 12);
      cableGeo.rotateZ(Math.PI / 2);
      const cableMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.3,
        emissive: col,
        emissiveIntensity: 0.4
      });
      const cable = new THREE.Mesh(cableGeo, cableMat);
      cable.position.set(0, tunnelY + 0.75, tunnelZ + tunnelW / 2 - 0.3 - (cIdx * 0.26));
      cable.userData = {
        subterraneanUtility: {
          title: '⚡ 11kV High Voltage 3-Phase Feeder',
          code: 'PSPCL-HT-11KV-CIRCUIT-04',
          desc: 'Primary underground electrical distribution trunk supplying North Amritsar Municipal Grid. 3-Phase armored XLPE copper conductor.',
          depth: '-3.8m (-12.5 ft)',
          dept: 'Punjab State Power Corp. Ltd. (PSPCL)',
          badgeColor: '#ef4444'
        }
      };
      group.add(cable);
    });

    // Underground Electric Substation Transformer Kiosk
    const kioskGeo = new THREE.BoxGeometry(2.4, 2.2, 1.8);
    const kioskMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5, metalness: 0.4 });
    const kiosk = new THREE.Mesh(kioskGeo, kioskMat);
    kiosk.position.set(-width / 4, tunnelY, tunnelZ + 0.3);
    kiosk.castShadow = true;
    kiosk.userData = {
      subterraneanUtility: {
        title: '⚡ 11kV/415V Compact Substation Kiosk',
        code: 'PSPCL-SUB-TRANS-8812',
        desc: 'Dry-type oil-immersed step-down transformer converting 11kV to 415V 3-phase domestic and commercial power supply.',
        depth: '-4.5m (-14.7 ft)',
        dept: 'PSPCL Grid Distribution Division',
        badgeColor: '#ef4444'
      }
    };
    group.add(kiosk);

    // Glowing red hazard warning beacon on transformer kiosk
    const beaconGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.25, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(-width / 4, tunnelY + 1.25, tunnelZ + 0.3);
    group.add(beacon);

    // TIER 2 (MIDDLE, Y = -4.5m): Optical Fiber Telecommunications Trunk (BharatNet / BSNL OFC)
    const ofcColors = [0x10b981, 0x06b6d4, 0xf97316, 0xa855f7]; // Green, Cyan, Orange, Purple
    ofcColors.forEach((col, oIdx) => {
      const fiberGeo = new THREE.CylinderGeometry(0.065, 0.065, tunnelLen, 12);
      fiberGeo.rotateZ(Math.PI / 2);
      const fiberMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.2,
        emissive: col,
        emissiveIntensity: 0.75
      });
      const fiber = new THREE.Mesh(fiberGeo, fiberMat);
      fiber.position.set(0, tunnelY + 0.05, tunnelZ + tunnelW / 2 - 0.3 - (oIdx * 0.2));
      fiber.userData = {
        subterraneanUtility: {
          title: '📶 96-Core Optical Fiber Municipal Backbone',
          code: 'BSNL-BHARATNET-OFC-RING-09',
          desc: 'High-speed gigabit optical fiber transmission line connecting Smart City CCTV cameras, IoT sensors, and high-speed broadband.',
          depth: '-4.5m (-14.7 ft)',
          dept: 'BSNL & Amritsar Smart City Telecom Network',
          badgeColor: '#10b981'
        }
      };
      group.add(fiber);
    });

    // Wall-Mounted Optical Fiber Splice Enclosure (Joint Box)
    const spliceBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x059669 }));
    spliceBox.position.set(width / 4, tunnelY + 0.05, tunnelZ + tunnelW / 2 - 0.2);
    spliceBox.userData = {
      subterraneanUtility: {
        title: '📶 Fiber Splice Enclosure & Optical Distribution Box',
        code: 'BSNL-FIBER-SPLICE-BOX-42',
        desc: 'Weatherproof optical joint closure housing 96-fiber splice trays and laser transmission splitters.',
        depth: '-4.5m (-14.7 ft)',
        dept: 'BSNL Telecom Optical Network',
        badgeColor: '#10b981'
      }
    };
    group.add(spliceBox);

    // TIER 3 (LOWER, Y = -5.2m): Low-Voltage SCADA & City Sensor Conduits
    const scadaCable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, tunnelLen, 12),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 })
    );
    scadaCable.geometry.rotateZ(Math.PI / 2);
    scadaCable.position.set(0, tunnelY - 0.65, tunnelZ + tunnelW / 2 - 0.4);
    group.add(scadaCable);

    // Overhead Linear LED Tunnel Light Fixtures with Warm Glow
    for (let lx = -tunnelLen / 2 + 3; lx <= tunnelLen / 2 - 3; lx += 6) {
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.1, 0.25),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      fixture.position.set(lx, tunnelY + tunnelH / 2 - 0.08, tunnelZ);
      group.add(fixture);

      // Embedded subtle point light for realistic subterranean ambiance
      const pLight = new THREE.PointLight(0xfef08a, 0.35, 8);
      pLight.position.set(lx, tunnelY + tunnelH / 2 - 0.3, tunnelZ);
      group.add(pLight);
    }

    // Vertical Maintenance Access Shaft & Street Manhole with Ladder Rungs
    const shaftRadius = 0.85;
    const shaftH = Math.abs(tunnelY + tunnelH / 2); // Distance from tunnel roof to street Y=0
    const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftH, 16);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(0, -shaftH / 2, tunnelZ);
    group.add(shaft);

    // Cast-iron manhole cover at street level (Y = 0)
    const manholeCover = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius + 0.15, shaftRadius + 0.15, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 })
    );
    manholeCover.position.set(0, 0.04, tunnelZ);
    manholeCover.userData = {
      subterraneanUtility: {
        title: '🕳️ Municipal Utility Gallery Access Manhole',
        code: 'MCA-UTIL-SHAFT-ASR-104',
        desc: 'Street-level cast-iron access manhole providing technician entry into walkable underground utility gallery.',
        depth: '0.0m to -4.5m',
        dept: 'Municipal Corporation Amritsar (MCA)',
        badgeColor: '#eab308'
      }
    };
    group.add(manholeCover);

    // Stainless Steel Safety Ladder Rungs inside the Shaft
    const rungMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    for (let ry = -0.4; ry >= -shaftH - 1.8; ry -= 0.45) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), rungMat);
      rung.geometry.rotateZ(Math.PI / 2);
      rung.position.set(0, ry, tunnelZ + shaftRadius - 0.15);
      group.add(rung);
    }

    // 5. POTABLE MUNICIPAL WATER TRANSMISSION MAIN PIPELINE (BLUE)
    // Sunk at -4.1m depth, high pressure ductile iron pipeline with flanged joints and red gate valve
    const waterRadius = 0.24;
    const waterLen = width + 6;
    const waterY = -4.1;
    const waterZ = -length / 3;

    const waterPipeGeo = new THREE.CylinderGeometry(waterRadius, waterRadius, waterLen, 20);
    waterPipeGeo.rotateZ(Math.PI / 2);
    const waterPipeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.25,
      metalness: 0.7,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.55
    });
    const waterPipe = new THREE.Mesh(waterPipeGeo, waterPipeMat);
    waterPipe.position.set(0, waterY, waterZ);
    waterPipe.userData = {
      subterraneanUtility: {
        title: '💧 450mm Ductile Iron Municipal Water Main',
        code: 'MCA-WTR-MAIN-450-DI-09',
        desc: 'Potable water transmission main under 6.5 bar operational pressure from Headworks to Kot Atma Singh distribution zone.',
        depth: '-4.1m (-13.5 ft)',
        dept: 'Amritsar Water Supply & Sanitation Board',
        badgeColor: '#00d4ff'
      }
    };
    group.add(waterPipe);

    // Flanged Spool Joint Rings with Bolts
    for (let fx = -waterLen / 2 + 3; fx <= waterLen / 2 - 3; fx += 5) {
      const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(waterRadius + 0.08, waterRadius + 0.08, 0.15, 16),
        new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.8, roughness: 0.3 })
      );
      flange.geometry.rotateZ(Math.PI / 2);
      flange.position.set(fx, waterY, waterZ);
      group.add(flange);
    }

    // Industrial Red Cast-Iron Gate Valve Assembly with Circular Handwheel
    const valveBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.6, roughness: 0.4 })
    );
    valveBody.position.set(width / 4, waterY, waterZ);
    group.add(valveBody);

    const valveStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 })
    );
    valveStem.position.set(width / 4, waterY + 0.8, waterZ);
    group.add(valveStem);

    const valveWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.05, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.7, roughness: 0.3 })
    );
    valveWheel.rotation.x = Math.PI / 2;
    valveWheel.position.set(width / 4, waterY + 1.4, waterZ);
    valveWheel.userData = {
      subterraneanUtility: {
        title: '💧 Isolation Gate Valve & Flow Meter',
        code: 'MCA-VALVE-DN450-PN16',
        desc: 'Resilient seated ductile iron wedge gate valve for sectional isolation during emergency repairs.',
        depth: '-2.7m to -4.1m',
        dept: 'MCA Water Supply Operations',
        badgeColor: '#00d4ff'
      }
    };
    group.add(valveWheel);

    // Domestic Water Tap-in Connection Line feeding into building plinth
    const waterTapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(width / 4, waterY, waterZ),
      new THREE.Vector3(width / 4, waterY + 1.5, 0),
      new THREE.Vector3(0, -0.4, 0)
    ]);
    const waterTapMesh = new THREE.Mesh(
      new THREE.TubeGeometry(waterTapCurve, 20, 0.12, 12, false),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 })
    );
    group.add(waterTapMesh);

    // 6. DEEP STORMWATER & SANITARY SEWERAGE TRUNK CULVERT
    // Sunk at deep -7.6m bedrock layer (750mm diameter concrete/terracotta sewer main)
    const sewerRadius = 0.38;
    const sewerLen = width + 6;
    const sewerY = -7.6;
    const sewerZ = 0;

    const sewerPipeGeo = new THREE.CylinderGeometry(sewerRadius, sewerRadius, sewerLen, 20);
    sewerPipeGeo.rotateZ(Math.PI / 2);
    const sewerPipeMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.8,
      metalness: 0.15,
      emissive: 0x78350f,
      emissiveIntensity: 0.4
    });
    const sewerPipe = new THREE.Mesh(sewerPipeGeo, sewerPipeMat);
    sewerPipe.position.set(0, sewerY, sewerZ);
    sewerPipe.userData = {
      subterraneanUtility: {
        title: '🚽 750mm RCC Sanitary & Stormwater Trunk Culvert',
        code: 'MCA-SEW-MAIN-750-RCC',
        desc: 'Deep gravitational sewer trunk line conveying municipal wastewater to Kot Atma Singh Sewage Treatment Plant (STP).',
        depth: '-7.6m (-25.0 ft)',
        dept: 'Amritsar Municipal Drainage & Sewerage Board',
        badgeColor: '#f59e0b'
      }
    };
    group.add(sewerPipe);

    // Precast Concrete Inspection Manhole Chamber on Sewer Line
    const sewerChamber = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 7.6, 16),
      new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 })
    );
    sewerChamber.position.set(-width / 3, -3.8, sewerZ);
    sewerChamber.userData = {
      subterraneanUtility: {
        title: '🚽 Deep Sewer Inspection Chamber & Drop Manhole',
        code: 'MCA-SEW-DROP-MH-77',
        desc: 'Heavy-duty precast concrete manhole chamber with internal benching channel for robotic crawler inspection and CCTV hydro-jetting.',
        depth: '0.0m to -7.6m',
        dept: 'MCA Sewerage Maintenance',
        badgeColor: '#f59e0b'
      }
    };
    group.add(sewerChamber);

    // 7. CITY PIPED NATURAL GAS (PNG) TRANSMISSION MAIN
    // High-visibility yellow steel conduit at -3.4m depth
    const gasRadius = 0.16;
    const gasLen = width + 6;
    const gasY = -3.4;
    const gasZ = -length / 2 + 3;

    const gasPipeGeo = new THREE.CylinderGeometry(gasRadius, gasRadius, gasLen, 16);
    gasPipeGeo.rotateZ(Math.PI / 2);
    const gasPipeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.5,
      emissive: 0xca8a04,
      emissiveIntensity: 0.65
    });
    const gasPipe = new THREE.Mesh(gasPipeGeo, gasPipeMat);
    gasPipe.position.set(0, gasY, gasZ);
    gasPipe.userData = {
      subterraneanUtility: {
        title: '⛽ Piped Natural Gas (PNG) Steel City Main',
        code: 'MCA-GAS-PNG-STEEL-150',
        desc: 'Underground city gas pipeline with cathodic corrosion protection, supplying domestic piped gas under 4 bar pressure.',
        depth: '-3.4m (-11.2 ft)',
        dept: 'Gujarat Gas Ltd / MCA Gas Utility',
        badgeColor: '#facc15'
      }
    };
    group.add(gasPipe);

    // 8. BIM DEEP STRUCTURAL FOUNDATION ENGINEERING (BORED PILES & REBAR CAGES)
    // Anchored under EVERY corner of the real building polygon down to -12m bedrock
    const pileRadius = 0.65;
    const pileDepth = 12.0;
    const pileMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88
    });

    const rebarMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xc2410c,
      emissiveIntensity: 0.5
    });

    footprint.localPoints.forEach((pt, pIdx) => {
      // Cast-in-situ concrete pile cylinder
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(pileRadius, pileRadius, pileDepth, 16), pileMat);
      pile.position.set(pt.x, -pileDepth / 2, pt.z);
      pile.castShadow = true;
      pile.userData = {
        subterraneanUtility: {
          title: `🏗️ 12m Cast-In-Situ Bored Concrete Foundation Pile #${pIdx + 1}`,
          code: `STR-PILE-B30-FND-${pIdx + 1}`,
          desc: 'IS 2911 compliant bored cast-in-situ reinforced concrete pile socketed into dense bedrock layer with 350-tonne safe load bearing capacity.',
          depth: '0.0m to -12.0m (-39.4 ft)',
          dept: 'Approved Structural Engineering Dept (IS 456/IS 2911)',
          badgeColor: '#f97316'
        }
      };
      group.add(pile);

      // Exposed Steel Rebar Cage (4 vertical high-tensile steel rods inside)
      for (let rAngle = 0; rAngle < Math.PI * 2; rAngle += Math.PI / 2) {
        const rx = pt.x + Math.cos(rAngle) * (pileRadius * 0.7);
        const rz = pt.z + Math.sin(rAngle) * (pileRadius * 0.7);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, pileDepth, 8), rebarMat);
        rod.position.set(rx, -pileDepth / 2, rz);
        group.add(rod);
      }

      // Massive Reinforced Concrete Pile Cap (2m x 2m x 0.9m)
      const capMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 2.0), capMat);
      cap.position.set(pt.x, -0.45, pt.z);
      cap.castShadow = true;
      group.add(cap);
    });

    // Reinforced Concrete Grade Tie Beams (Interconnecting all Pile Caps in a Rigid Grid)
    const tieBeamMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
    for (let i = 0; i < footprint.localPoints.length; i++) {
      const p1 = footprint.localPoints[i];
      const p2 = footprint.localPoints[(i + 1) % footprint.localPoints.length];
      const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      if (dist > 0.5) {
        const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.65, 0.55), tieBeamMat);
        beam.position.set((p1.x + p2.x) / 2, -0.45, (p1.z + p2.z) / 2);
        beam.rotation.y = -angle;
        group.add(beam);
      }
    }

    // 9. 3D DEPTH MEASUREMENT RULERS & LEVEL CALLOUT LABELS
    const rulerPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, depth, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 })
    );
    rulerPole.position.set(-width / 2 + 1, -depth / 2, -length / 2 + 1);
    group.add(rulerPole);

    // Glowing depth tick marks at 0m, -3.5m, -6.8m, -11.5m
    [0.0, -3.5, -6.8, -11.5].forEach(yPos => {
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x00f2fe })
      );
      tick.position.set(-width / 2 + 1.4, yPos, -length / 2 + 1);
      group.add(tick);
    });

    // 10. CONNECTED LINES OF WIRES, CABLES & PIPELINES ROUTED DIRECTLY INTO THE BUILDING
    // Originates from municipal street utility gallery and penetrates into building foundation and vertical risers

    // A. 3-Phase High-Voltage Electrical Feeder Cables (Red, Yellow, Blue lines)
    const feederColors = [0xff2222, 0xffd700, 0x0088ff];
    feederColors.forEach((fCol, fIdx) => {
      const startPt = new THREE.Vector3(
        -width / 4 + (fIdx * 0.38),
        tunnelY + 0.75,
        tunnelZ + tunnelW / 2 - 0.3
      );
      const midPt = new THREE.Vector3(
        -width / 4 + (fIdx * 0.38),
        -1.8,
        length / 4
      );
      const endPt = new THREE.Vector3(
        -width / 4 + (fIdx * 0.38),
        -0.4,
        length / 4
      );

      const feederCurve = new THREE.CatmullRomCurve3([startPt, midPt, endPt]);
      const feederGeo = new THREE.TubeGeometry(feederCurve, 24, 0.1, 10, false);
      const feederMat = new THREE.MeshStandardMaterial({
        color: fCol,
        roughness: 0.25,
        metalness: 0.6,
        emissive: fCol,
        emissiveIntensity: 0.75
      });
      const feederMesh = new THREE.Mesh(feederGeo, feederMat);
      feederMesh.userData = {
        subterraneanUtility: {
          title: `⚡ 3-Phase Power Feeder Connection Line [Phase ${fIdx + 1}]`,
          code: `PSPCL-FEEDER-LINE-P${fIdx + 1}`,
          desc: 'Direct underground XLPE power line supplying electricity from municipal gallery transformer to building Main Distribution Board.',
          depth: '-1.8m to -3.8m',
          dept: 'PSPCL Amritsar Urban Division',
          badgeColor: '#ef4444'
        }
      };
      group.add(feederMesh);
      this.animatedPulseObjects.push(feederMesh);
    });

    // Building Main Distribution Board (MDB) at foundation level
    const mdbBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 })
    );
    mdbBox.position.set(-width / 4, -0.4, length / 4);
    group.add(mdbBox);

    // Indicator status LEDs on MDB
    [-0.45, 0, 0.45].forEach((lx, li) => {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: feederColors[li] })
      );
      led.position.set(-width / 4 + lx, 0.15, length / 4 + 0.32);
      group.add(led);
    });

    // B. Municipal Potable Water Inlet Supply Line (Bright Cyan Pipe)
    const waterInletCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(width / 5, waterY, waterZ),
      new THREE.Vector3(width / 5, -1.5, -length / 6),
      new THREE.Vector3(width / 5, -0.3, 0),
      new THREE.Vector3(width / 5, 2.8, 0) // Rises into building internal plumbing shaft!
    ]);
    const waterInletGeo = new THREE.TubeGeometry(waterInletCurve, 32, 0.15, 12, false);
    const waterInletMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      metalness: 0.75,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.95
    });
    const waterInletMesh = new THREE.Mesh(waterInletGeo, waterInletMat);
    waterInletMesh.userData = {
      subterraneanUtility: {
        title: '💧 Municipal Potable Water Inlet & Vertical Riser',
        code: 'MCA-WTR-INLET-PIPE-150',
        desc: 'Potable water connection line branching from municipal ductile iron main, routed through AMR pulse water meter to building internal riser.',
        depth: '-4.1m to +2.8m',
        dept: 'Amritsar Water Supply & Sanitation Board',
        badgeColor: '#00d4ff'
      }
    };
    group.add(waterInletMesh);
    this.animatedPulseObjects.push(waterInletMesh);

    // AMR Smart Water Meter on water inlet line
    const waterMeter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.45, 16),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.8, roughness: 0.2 })
    );
    waterMeter.position.set(width / 5, -0.8, -length / 6);
    group.add(waterMeter);

    // C. Piped Natural Gas (PNG) Feeder Pipeline (Yellow)
    const gasInletCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, gasY, gasZ),
      new THREE.Vector3(0, -1.2, -length / 4),
      new THREE.Vector3(0, -0.4, -length / 4 + 1.2)
    ]);
    const gasInletGeo = new THREE.TubeGeometry(gasInletCurve, 24, 0.12, 10, false);
    const gasInletMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.65,
      roughness: 0.3,
      emissive: 0xca8a04,
      emissiveIntensity: 0.85
    });
    const gasInletMesh = new THREE.Mesh(gasInletGeo, gasInletMat);
    gasInletMesh.userData = {
      subterraneanUtility: {
        title: '⛽ Piped Natural Gas (PNG) Intake Line',
        code: 'MCA-PNG-INLET-BRANCH-75',
        desc: 'High-density polyethylene coated steel gas service line entering building foundation, equipped with emergency slam-shut valve.',
        depth: '-1.2m to -3.4m',
        dept: 'Gujarat Gas Ltd / MCA Gas Utility',
        badgeColor: '#facc15'
      }
    };
    group.add(gasInletMesh);
    this.animatedPulseObjects.push(gasInletMesh);

    // D. BharatNet High-Speed Optical Fiber Cable Trunk (Green & Cyan)
    const fiberColors = [0x10b981, 0x06b6d4];
    fiberColors.forEach((fibCol, fibIdx) => {
      const fibCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(width / 4 - (fibIdx * 0.3), tunnelY + 0.05, tunnelZ + tunnelW / 2 - 0.3),
        new THREE.Vector3(width / 4 - (fibIdx * 0.3), -1.5, length / 5),
        new THREE.Vector3(width / 4 - (fibIdx * 0.3), -0.4, length / 5)
      ]);
      const fibGeo = new THREE.TubeGeometry(fibCurve, 24, 0.07, 8, false);
      const fibMat = new THREE.MeshStandardMaterial({
        color: fibCol,
        roughness: 0.2,
        emissive: fibCol,
        emissiveIntensity: 1.0
      });
      const fibMesh = new THREE.Mesh(fibGeo, fibMat);
      fibMesh.userData = {
        subterraneanUtility: {
          title: `📶 Optical Fiber Data Connection Line #${fibIdx + 1}`,
          code: `BSNL-OFC-FEEDER-C${fibIdx + 1}`,
          desc: 'Direct gigabit fiber line connecting smart meters, CCTV telemetry, and high-speed broadband to building server rack.',
          depth: '-1.5m to -4.5m',
          dept: 'BSNL & Smart City Amritsar',
          badgeColor: '#10b981'
        }
      };
      group.add(fibMesh);
      this.animatedPulseObjects.push(fibMesh);
    });

    // E. Sanitary Sewer Discharge Outflow Line (Orange/Brown Sloped Pipe)
    const sewerOutflowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-width / 5, -0.4, 0),
      new THREE.Vector3(-width / 5, -3.2, -length / 8),
      new THREE.Vector3(0, sewerY + 0.3, sewerZ)
    ]);
    const sewerOutflowGeo = new THREE.TubeGeometry(sewerOutflowCurve, 24, 0.2, 12, false);
    const sewerOutflowMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x92400e,
      emissiveIntensity: 0.6
    });
    const sewerOutflowMesh = new THREE.Mesh(sewerOutflowGeo, sewerOutflowMat);
    sewerOutflowMesh.userData = {
      subterraneanUtility: {
        title: '🚽 Building Sanitary Soil Stack Outflow Pipe',
        code: 'MCA-SEW-OUTFLOW-150-CI',
        desc: 'Gravity-fed cast-iron waste discharge line connecting internal plumbing stacks to deep municipal sewer culvert.',
        depth: '-0.4m to -7.6m',
        dept: 'Amritsar Municipal Drainage & Sewerage Board',
        badgeColor: '#f59e0b'
      }
    };
    group.add(sewerOutflowMesh);
    this.animatedPulseObjects.push(sewerOutflowMesh);
  }

  buildDimensionLines(footprint) {
    const width = footprint.width;
    const length = footprint.length;
    const totalHeight = (this.currentParcel?.total_floors || 3) * 3.3;

    // Dimension lines material
    const dimMat = new THREE.LineDashedMaterial({
      color: 0x00f2fe,
      linewidth: 2,
      dashSize: 0.8,
      gapSize: 0.3
    });
    const tickMat = new THREE.LineBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.7 });

    // 1. Front Width dimension line (X-Axis)
    const widthGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width/2, 0.2, length/2 + 2.5),
      new THREE.Vector3(width/2, 0.2, length/2 + 2.5)
    ]);
    const widthLine = new THREE.Line(widthGeo, dimMat);
    widthLine.computeLineDistances();
    this.dimensionLinesGroup.add(widthLine);

    [-width/2, width/2].forEach(x => {
      const tick = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.2, length/2 + 1.8),
          new THREE.Vector3(x, 0.2, length/2 + 3.2)
        ]),
        tickMat
      );
      this.dimensionLinesGroup.add(tick);
    });

    // 2. Side Depth dimension line (Z-Axis)
    const lengthGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(width/2 + 2.5, 0.2, -length/2),
      new THREE.Vector3(width/2 + 2.5, 0.2, length/2)
    ]);
    const lengthLine = new THREE.Line(lengthGeo, dimMat);
    lengthLine.computeLineDistances();
    this.dimensionLinesGroup.add(lengthLine);

    [-length/2, length/2].forEach(z => {
      const tick = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(width/2 + 1.8, 0.2, z),
          new THREE.Vector3(width/2 + 3.2, 0.2, z)
        ]),
        tickMat
      );
      this.dimensionLinesGroup.add(tick);
    });

    // 3. Vertical Height dimension line (Y-Axis)
    const heightGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width/2 - 2.5, 0, length/2 + 1),
      new THREE.Vector3(-width/2 - 2.5, totalHeight, length/2 + 1)
    ]);
    const heightLine = new THREE.Line(heightGeo, dimMat);
    heightLine.computeLineDistances();
    this.dimensionLinesGroup.add(heightLine);

    [0, totalHeight].forEach(y => {
      const tick = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-width/2 - 3.2, y, length/2 + 1),
          new THREE.Vector3(-width/2 - 1.8, y, length/2 + 1)
        ]),
        tickMat
      );
      this.dimensionLinesGroup.add(tick);
    });
  }

  setExplodeFactor(factor) {
    this.explodeFactor = factor; // 0.0 to 1.0

    this.floorMeshes.forEach((group, idx) => {
      const lvl = group.userData.levelData;
      if (!lvl) return;
      if (lvl.is_subterranean) {
        group.position.y = group.userData.initialY - (factor * 7.5);
      } else {
        const floorIndex = group.userData.floorIndex !== undefined ? group.userData.floorIndex : idx;
        // Ground floor (floorIndex = 0) stays firmly at Y=0; upper floors lift progressively
        group.position.y = group.userData.initialY + (factor * floorIndex * 5.2);
      }
    });

    if (this.selectedLevelCode) {
      this.updateSelectionBracket(this.selectedLevelCode);
    }
  }

  setHistoricalYear(year) {
    year = parseInt(year, 10);

    // 2018 Vacant Open Plot Boundary Stone Pillars
    if (!this.vacantPlotGroup) {
      this.vacantPlotGroup = new THREE.Group();
      const pegGeo = new THREE.BoxGeometry(0.5, 1.4, 0.5);
      const pegMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xb45309,
        emissiveIntensity: 0.4
      });
      const w = 15, l = 16;
      [
        [-w/2, -l/2], [w/2, -l/2], [-w/2, l/2], [w/2, l/2]
      ].forEach(([px, pz]) => {
        const peg = new THREE.Mesh(pegGeo, pegMat);
        peg.position.set(px, 0.7, pz);
        this.vacantPlotGroup.add(peg);
      });

      const bndGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w/2, 0.4, -l/2),
        new THREE.Vector3(w/2, 0.4, -l/2),
        new THREE.Vector3(w/2, 0.4, l/2),
        new THREE.Vector3(-w/2, 0.4, l/2),
        new THREE.Vector3(-w/2, 0.4, -l/2)
      ]);
      const bndLine = new THREE.Line(bndGeo, new THREE.LineDashedMaterial({ color: 0xffd700, dashSize: 0.6, gapSize: 0.3 }));
      bndLine.computeLineDistances();
      this.vacantPlotGroup.add(bndLine);
      this.scene.add(this.vacantPlotGroup);
    }

    this.vacantPlotGroup.visible = (year === 2018);

    // CRITICAL FIX: NEVER set group.visible = false on building floors!
    // Every floor remains visible so the user never sees floors vanish into thin air.
    // Future additions are rendered as a translucent blueprint wireframe preview.
    this.floorMeshes.forEach((group) => {
      const lvl = group.userData.levelData;
      let isBuiltInPeriod = true;

      const isGround = (lvl.level_code === 'G00' || lvl.level_code === 'Ground' || lvl.level_code === 'G0');
      if (lvl.is_subterranean) {
        isBuiltInPeriod = (year >= 2020);
      } else if (isGround) {
        isBuiltInPeriod = (year >= 2020);
      } else if (lvl.level_code === 'F01') {
        isBuiltInPeriod = (year >= 2022);
      } else if (lvl.level_code === 'F02') {
        isBuiltInPeriod = (year >= 2024);
      } else {
        isBuiltInPeriod = (year >= 2026);
      }

      group.visible = true; // ALWAYS visible!

      group.traverse(child => {
        if (child.isMesh && child.material) {
          child.visible = true;
          if (!isBuiltInPeriod) {
            // Future extension: semi-transparent blueprint wireframe preview, NEVER vanished!
            child.material.transparent = true;
            child.material.opacity = 0.45;
          } else {
            // Built floor: 100% solid rendering
            child.material.transparent = !!lvl.is_subterranean;
            child.material.opacity = lvl.is_subterranean ? 0.88 : 1.0;
            child.material.depthWrite = true;
          }
        }
      });
    });
  }

  setVisibleLevels(activeLevelCodes) {
    if (!this.floorMeshes || this.floorMeshes.length === 0) return;
    this.floorMeshes.forEach(group => {
      const lvl = group.userData.levelData;
      if (!lvl) return;
      const isGround = (lvl.level_code === 'G00' || lvl.level_code === 'Ground' || lvl.level_code === 'G0');
      const isMatch = activeLevelCodes.includes(lvl.level_code) ||
        (isGround && (activeLevelCodes.includes('G00') || activeLevelCodes.includes('Ground') || activeLevelCodes.includes('G0')));

      group.visible = true;
      group.traverse(child => {
        if (child.isMesh && child.material) {
          child.visible = true;
          if (isMatch) {
            child.material.transparent = !!lvl.is_subterranean;
            child.material.opacity = lvl.is_subterranean ? 0.88 : 1.0;
            child.material.depthWrite = true;
          } else {
            child.material.transparent = true;
            child.material.opacity = 0.35;
          }
        }
      });
    });
  }

  setViewMode(mode) {
    this.viewMode = mode; // 'textured' or 'blueprint'
    const isBlueprint = (mode === 'blueprint');

    // Sharp & Dynamic High-Tech Grey & Black Cadastre Studio
    this.scene.background = new THREE.Color(0x090d16);
    if (this.scene.fog) this.scene.fog.color.set(0x090d16);

    this.floorMeshes.forEach(group => {
      group.traverse(child => {
        if (child.isMesh && child.material) {
          if (isBlueprint) {
            if (!child.userData.savedMat) child.userData.savedMat = child.material;

            if (child.userData.isStructure) {
              // Structural columns: crisp matte slate grey
              child.material = new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.5,
                metalness: 0.2
              });
            } else if (child.userData.isInteriorWall) {
              // Interior partition walls: clean neutral grey
              child.material = new THREE.MeshStandardMaterial({
                color: 0x64748b,
                roughness: 0.6,
                metalness: 0.1
              });
            } else if (child.geometry?.type === 'PlaneGeometry' || child.geometry?.type === 'ShapeGeometry') {
              // Interior floor plate: white & grey architectural blueprint
              child.material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide
              });
              if (child.userData.levelData) {
                child.material.map = createBlueprintFloorTexture(child.userData.levelData.name);
                child.material.needsUpdate = true;
              }
              child.visible = true;
            } else {
              // Exterior facade walls: sharp architectural slate grey wireframe (or red if violation flagged)
              child.material = new THREE.MeshBasicMaterial({
                color: child.userData.levelData?.is_flagged ? 0xdc2626 : 0x475569,
                wireframe: true,
                transparent: true,
                opacity: 0.8
              });
            }
          } else {
            // Restore textured material
            if (child.userData.savedMat) {
              child.material = child.userData.savedMat;
            }
          }
        }
      });
    });

    if (this.dimensionLinesGroup) {
      this.dimensionLinesGroup.visible = true;
    }
  }

  toggleGroundSatellite(show) {
    if (this.groundMesh) {
      this.groundMesh.visible = (show !== false);
    }
  }

  selectLevel(levelCode) {
    this.selectedLevelCode = levelCode;
    const isSub = (levelCode === 'B30');

    // Auto-toggle subterranean transparency if B30 is selected
    this.setSubterraneanMode(isSub);

    const isGroundTarget = (levelCode === 'G00' || levelCode === 'Ground' || levelCode === 'G0');

    this.floorMeshes.forEach(group => {
      const lvl = group.userData.levelData;
      const isThisFloorGround = (lvl.level_code === 'G00' || lvl.level_code === 'Ground' || lvl.level_code === 'G0');
      const isSelected = (lvl.level_code === levelCode) || (isGroundTarget && isThisFloorGround);

      // CRITICAL GUARANTEE: NEVER set group.visible = false! Every floor remains 100% visible!
      group.visible = true;

      group.traverse(child => {
        if (child.isMesh && child.material) {
          child.visible = true; // Every child stays visible!

          // GUARANTEE: Above-ground floors are ALWAYS 100% opaque, solid, never vanishing!
          if (lvl.is_subterranean) {
            child.material.transparent = true;
            child.material.opacity = this.subterraneanMode ? 0.88 : 0.45;
          } else {
            child.material.transparent = false;
            child.material.opacity = 1.0;
            child.material.depthWrite = true;
          }

          if (isSelected) {
            // Highlight selected floor with cyan / red illumination
            if (child.material.emissive) {
              child.material.emissive = new THREE.Color(lvl.is_flagged ? 0xff0022 : 0x00d2ff);
              child.material.emissiveIntensity = 0.65;
            }
          } else {
            if (child.material.emissive) {
              child.material.emissive = new THREE.Color(lvl.is_flagged ? 0x880011 : 0x000000);
              child.material.emissiveIntensity = lvl.is_flagged ? 0.35 : 0;
            }
          }
        }
      });
    });

    this.updateSelectionBracket(levelCode);
  }

  setSubterraneanMode(enabled) {
    this.subterraneanMode = !!enabled;

    if (this.groundMesh && this.groundMesh.material) {
      if (this.subterraneanMode) {
        this.groundMesh.material.transparent = true;
        this.groundMesh.material.opacity = 0.22;
      } else {
        this.groundMesh.material.opacity = 1.0;
        this.groundMesh.material.transparent = false;
      }
    }

    if (this.controls) {
      if (this.subterraneanMode) {
        // Center camera slightly lower to focus directly into the subterranean utility tunnel and deep foundations
        this.controls.target.set(0, -4.5, 0);
      } else {
        const floorCount = Math.max(1, this.floorMeshes.filter(m => !m.userData.levelData?.is_subterranean).length);
        this.controls.target.set(0, (floorCount * 3.3) / 2, 0);
      }
      this.controls.update();
    }
  }

  updateSelectionBracket(levelCode) {
    if (this.selectionBracketGroup) {
      this.scene.remove(this.selectionBracketGroup);
      this.selectionBracketGroup.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      this.selectionBracketGroup = null;
    }

    if (!levelCode) return;

    const isGroundTarget = (levelCode === 'G00' || levelCode === 'Ground' || levelCode === 'G0');
    const targetGroup = this.floorMeshes.find(g => {
      const c = g.userData?.levelData?.level_code;
      return c === levelCode || (isGroundTarget && (c === 'G00' || c === 'Ground' || c === 'G0'));
    });

    if (!targetGroup || !this.currentFootprint) return;

    this.selectionBracketGroup = new THREE.Group();

    const lvlData = targetGroup.userData?.levelData;
    const isFlagged = lvlData?.is_flagged;
    const isSub = lvlData?.is_subterranean;
    const levelHeight = isSub ? 9.14 : 3.3;
    const baseY = targetGroup.position.y;
    const topY = baseY + levelHeight;

    const bracketColor = isFlagged ? 0xff0022 : 0x00f2fe;

    // 1. Build CAD wireframe that EXACTLY follows the building's physical polygon perimeter
    const pts = this.currentFootprint.localPoints;
    const linePositions = [];

    // Bottom perimeter loop
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      linePositions.push(p1.x, baseY - 0.04, p1.z);
      linePositions.push(p2.x, baseY - 0.04, p2.z);
    }

    // Top perimeter loop
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      linePositions.push(p1.x, topY + 0.04, p1.z);
      linePositions.push(p2.x, topY + 0.04, p2.z);
    }

    // Vertical corner edge struts connecting bottom to top on EVERY corner of the real building!
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      linePositions.push(p.x, baseY - 0.04, p.z);
      linePositions.push(p.x, topY + 0.04, p.z);
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: bracketColor,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });
    const wireframe = new THREE.LineSegments(lineGeo, lineMat);
    this.selectionBracketGroup.add(wireframe);

    // 2. Glowing L-shaped CAD corner tick markers on each vertex
    const cornerPositions = [];
    pts.forEach((pt, i) => {
      const nextPt = pts[(i + 1) % pts.length];
      const prevPt = pts[(i - 1 + pts.length) % pts.length];

      const v1Len = Math.hypot(nextPt.x - pt.x, nextPt.z - pt.z);
      const v2Len = Math.hypot(prevPt.x - pt.x, prevPt.z - pt.z);
      const bracketArm = Math.min(1.4, Math.min(v1Len, v2Len) * 0.35);

      const v1x = ((nextPt.x - pt.x) / v1Len) * bracketArm;
      const v1z = ((nextPt.z - pt.z) / v1Len) * bracketArm;
      const v2x = ((prevPt.x - pt.x) / v2Len) * bracketArm;
      const v2z = ((prevPt.z - pt.z) / v2Len) * bracketArm;

      // Top corner bracket
      cornerPositions.push(pt.x + v1x, topY + 0.06, pt.z + v1z);
      cornerPositions.push(pt.x, topY + 0.06, pt.z);
      cornerPositions.push(pt.x, topY + 0.06, pt.z);
      cornerPositions.push(pt.x + v2x, topY + 0.06, pt.z + v2z);

      // Bottom corner bracket
      cornerPositions.push(pt.x + v1x, baseY - 0.06, pt.z + v1z);
      cornerPositions.push(pt.x, baseY - 0.06, pt.z);
      cornerPositions.push(pt.x, baseY - 0.06, pt.z);
      cornerPositions.push(pt.x + v2x, baseY - 0.06, pt.z + v2z);
    });

    const cornerGeo = new THREE.BufferGeometry();
    cornerGeo.setAttribute('position', new THREE.Float32BufferAttribute(cornerPositions, 3));
    const cornerMat = new THREE.LineBasicMaterial({
      color: bracketColor,
      linewidth: 4,
      transparent: true,
      opacity: 1.0
    });
    const cornerMesh = new THREE.LineSegments(cornerGeo, cornerMat);
    this.selectionBracketGroup.add(cornerMesh);

    this.scene.add(this.selectionBracketGroup);
  }

  onMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (!this.buildingGroup) return;
    const intersects = this.raycaster.intersectObjects(this.buildingGroup.children, true);

    if (intersects.length > 0) {
      let hit = intersects[0].object;

      // Check if user hovered over a subterranean utility directly
      if (hit.userData?.subterraneanUtility) {
        this.hoveredFloor = null;
        this.showSubterraneanHoverTag(hit.userData.subterraneanUtility, hit);
        return;
      }

      let levelData = hit.userData?.levelData;
      while (!levelData && hit.parent && hit.parent !== this.buildingGroup) {
        hit = hit.parent;
        levelData = hit.userData?.levelData;
      }

      if (levelData) {
        this.hoveredFloor = levelData;
        this.show3DHoverTag(levelData, hit);
        return;
      }
    }

    this.hoveredFloor = null;
    this.hide3DHoverTag();
  }

  showSubterraneanHoverTag(subUtil, hitObject) {
    if (!this.hoverTag) return;

    this.hoverTag.innerHTML = `
      <div class="tag-title" style="color: #38bdf8;">${subUtil.title}</div>
      <div class="tag-code" style="color: ${subUtil.badgeColor || '#00d2ff'};">${subUtil.code}</div>
      <div style="font-size: 0.74rem; color: #cbd5e1; margin-bottom: 4px; line-height: 1.4;">
        ${subUtil.desc}
      </div>
      <div style="font-size: 0.7rem; color: #94a3b8;">
        Depth: <strong>${subUtil.depth}</strong> &bull; Dept: <strong>${subUtil.dept}</strong>
      </div>
    `;

    this.positionHoverTag(hitObject);
  }

  show3DHoverTag(levelData, hitObject) {
    if (!this.hoverTag) return;

    const isSub = levelData.is_subterranean;
    const isFlag = levelData.is_flagged;

    const statusBadge = isFlag
      ? '<span style="color: #ef4444; font-weight: bold;">🚨 UNAUTHORIZED LEVEL (24H NOTICE)</span>'
      : isSub
      ? '<span style="color: #38bdf8;">Depth: -30.0 ft (-9.14m) GPR Verified</span>'
      : '<span style="color: #10b981;">Approved Cadastral Floor</span>';

    this.hoverTag.innerHTML = `
      <div class="tag-title">${levelData.name}</div>
      <div class="tag-code">${levelData.sub_ulpin}</div>
      <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 4px;">
        Owner: <strong>${levelData.owner}</strong><br>
        Carpet Area: <strong>${levelData.carpet_area_sqft || 1200} sq.ft</strong>
      </div>
      <div>${statusBadge}</div>
    `;

    this.positionHoverTag(hitObject);
  }

  positionHoverTag(hitObject) {
    const rect = this.container.getBoundingClientRect();
    let posX = rect.width * 0.5 + 50;
    let posY = rect.height * 0.5;

    if (hitObject) {
      const worldPos = new THREE.Vector3();
      hitObject.getWorldPosition(worldPos);
      worldPos.x += 8.5; // Project to the right edge
      worldPos.project(this.camera);

      posX = (worldPos.x * 0.5 + 0.5) * rect.width;
      posY = (-(worldPos.y * 0.5) + 0.5) * rect.height - 35;
    }

    // Clamp strictly within viewport boundaries
    const tagWidth = 270;
    const tagHeight = 145;
    posX = Math.max(15, Math.min(posX, rect.width - tagWidth - 25));
    posY = Math.max(15, Math.min(posY, rect.height - tagHeight - 25));

    this.hoverTag.style.display = 'block';
    this.hoverTag.style.left = `${posX}px`;
    this.hoverTag.style.top = `${posY}px`;
  }

  hide3DHoverTag() {
    if (this.hoverTag) {
      this.hoverTag.style.display = 'none';
    }
  }

  onClick(e) {
    if (this.hoveredFloor && this.onSelectLevel) {
      this.onSelectLevel(this.hoveredFloor);
    }
  }

  onResize() {
    if (!this.renderer || !this.camera || !this.container) return;
    const width = this.container.clientWidth || Math.max(window.innerWidth - 440, 600);
    const height = this.container.clientHeight || Math.max(window.innerHeight - 120, 500);
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (this.controls) {
      this.controls.update();
    }

    const time = performance.now() * 0.003;
    const pulse = (Math.sin(time) + 1) * 0.5;

    // Animate Drone Hover & Propellers in Pending Survey Mode
    if (this.dronePropellers && this.dronePropellers.length > 0) {
      this.dronePropellers.forEach((p, idx) => {
        p.rotation.y += (idx % 2 === 0 ? 0.45 : -0.45);
      });
    }

    if (this.droneMesh && !this.isExecutingScan) {
      const droneBob = Math.sin(time * 2.0) * 0.22;
      this.droneMesh.position.y = this.droneBaseY + droneBob;
    }

    if (this.lidarBeamMesh && this.lidarBeamMesh.material) {
      this.lidarBeamMesh.material.opacity = 0.2 + pulse * 0.25;
    }

    // Gentle pulsation for flagged unauthorized level
    if (this.buildingGroup) {
      this.buildingGroup.traverse(child => {
        if (child.isMesh && child.userData.levelData?.is_flagged && child.material && !child.material.wireframe) {
          child.material.emissiveIntensity = 0.25 + (pulse * 0.55);
        }
      });
    }

    // Gentle pulsation for active 3D selection bracket
    if (this.selectionBracketGroup) {
      this.selectionBracketGroup.traverse(child => {
        if (child.material) {
          child.material.opacity = 0.65 + (pulse * 0.35);
        }
      });
    }

    // Dynamic Flow Pulsation along connected cables, fiber optics, and water pipelines
    if (this.animatedPulseObjects && this.animatedPulseObjects.length > 0) {
      const flowTime = performance.now() * 0.005;
      this.animatedPulseObjects.forEach((obj, idx) => {
        if (obj.material) {
          const flowPulse = (Math.sin(flowTime + idx * 0.8) + 1) * 0.5;
          obj.material.emissiveIntensity = 0.5 + flowPulse * 0.7;
        }
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  zoomIn(factor = 0.75) {
    if (this.controls && this.camera) {
      const f = factor > 1 ? (1 / factor) : factor;
      this.camera.position.sub(this.controls.target).multiplyScalar(f).add(this.controls.target);
      this.controls.update();
    }
  }

  zoomOut(factor = 1.35) {
    if (this.controls && this.camera) {
      const f = factor < 1 ? (1 / factor) : factor;
      this.camera.position.sub(this.controls.target).multiplyScalar(f).add(this.controls.target);
      this.controls.update();
    }
  }

  resetCamera() {
    if (this.controls && this.camera && this.currentFootprint) {
      const maxDim = Math.max(this.currentFootprint.width, this.currentFootprint.length, 16);
      const floorCount = Math.max(1, (this.currentParcel?.total_floors || 3));
      const targetY = (floorCount * 3.3) / 2;
      const camDist = Math.max(22, maxDim * 1.5);
      this.camera.position.set(camDist * 0.85, targetY + camDist * 0.65, camDist * 1.1);
      this.controls.target.set(0, targetY, 0);
      this.controls.update();
    }
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
