// 3D City Map Controller (MapLibre GL JS + Real 3D Extruded Buildings + Multi-Layer Views + Labels)
export class CadastreMap2D {
  constructor(containerId, parcels, onSelectParcel) {
    this.containerId = containerId;
    this.parcels = parcels;
    this.onSelectParcel = onSelectParcel;
    this.map = null;
    this.hoverHud = document.getElementById('map-hover-hud');
    this.hoveredBuildingId = null;
    this.currentBaseLayer = 'satellite'; // 'satellite', 'street', 'topo'
    this.buildingsLoaded = false;
    this.pickerMode = null; // 'draw' or 'select'
    this.onPickerComplete = null;
    this.onPickerCancel = null;
    this.drawnPoints = [];
  }

  init() {
    if (this.map) return;

    // Exact Amritsar Center [lng, lat]
    const amritsarCenter = [74.8620, 31.6125];

    // Initialize MapLibre GL immediately with base raster layers
    this.map = new maplibregl.Map({
      container: this.containerId,
      style: {
        version: 8,
        sources: {
          // 1. ESRI High-Resolution World Satellite Imagery with automatic overscaling
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: 'Tiles &copy; Esri &bull; ISRO Bhuvan &bull; Govt of India'
          },
          // 2. ESRI Official Place & Boundary Labels Layer
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 18
          },
          // 3. ESRI Official Street & Highway Transportation Layer
          'esri-transportation': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 18
          },
          // 4. OpenStreetMap Standard Street View
          'osm-street': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          },
          // 5. ESRI Topo / Shaded Relief Terrain
          'esri-topo': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: 'Tiles &copy; Esri World Topo'
          }
        },
        layers: [
          // Base 0: Solid Cadastre Slate Canvas (Ensures the map canvas is NEVER blank white!)
          {
            id: 'layer-cadastre-base',
            type: 'background',
            paint: {
              'background-color': '#09101d'
            }
          },
          // Base 1: Satellite
          {
            id: 'layer-satellite',
            type: 'raster',
            source: 'esri-satellite',
            layout: { visibility: 'visible' }
          },
          // Base 2: Street Map
          {
            id: 'layer-street',
            type: 'raster',
            source: 'osm-street',
            layout: { visibility: 'none' }
          },
          // Base 3: Topo Terrain
          {
            id: 'layer-topo',
            type: 'raster',
            source: 'esri-topo',
            layout: { visibility: 'none' }
          },
          // Road Network Overlay for Satellite
          {
            id: 'layer-transportation',
            type: 'raster',
            source: 'esri-transportation',
            layout: { visibility: 'visible' }
          },
          // Crisp Street & Landmark Labels Layer
          {
            id: 'layer-labels',
            type: 'raster',
            source: 'esri-labels',
            layout: { visibility: 'visible' }
          }
        ]
      },
      center: amritsarCenter,
      zoom: 16.5,
      pitch: 58,    // 3D Perspective Tilt looking across the 3D skyline
      bearing: -24, // 3D Camera Rotation
      minZoom: 1,   // Unrestricted nationwide and global zoom-out
      maxZoom: 22,  // Close-up sub-meter building inspection
      scrollZoom: true,
      dragRotate: true,
      touchZoomRotate: true,
      maxPitch: 85,
      antialias: true
    });

    // Idempotent Map Ready Sequence: runs on 'load', 'style.load', or fallback timer
    this.setupDone = false;
    const runMapSetup = () => {
      if (this.setupDone) return;
      this.setupDone = true;
      this.isLoaded = true;
      this.invalidateSize();
      this.load3DBuildings();
      this.setupInteractions();
      this.setupDrawingLayers();
      this.bindToolbarButtons();
      this.setupFloatingControls();

      if (this.pendingFlyToParcel) {
        const target = this.pendingFlyToParcel;
        this.pendingFlyToParcel = null;
        setTimeout(() => this.flyToParcel(target), 150);
      }
    };

    this.map.on('load', runMapSetup);
    this.map.on('style.load', runMapSetup);
    // Crucial: do not hang if network raster tiles are delayed or offline!
    setTimeout(() => {
      if (!this.setupDone && this.map) {
        runMapSetup();
      }
    }, 150);

    // Update dynamic zoom badge on map zoom
    this.map.on('zoom', () => {
      this.updateZoomBadge();
    });

    // Attach ResizeObserver to container so size changes automatically resize map canvas
    const containerEl = document.getElementById(this.containerId);
    if (window.ResizeObserver && containerEl) {
      this.resizeObserver = new ResizeObserver(() => {
        this.invalidateSize();
      });
      this.resizeObserver.observe(containerEl);
    }
  }

  async load3DBuildings() {
    if (this.buildingsLoaded) return;
    this.buildingsLoaded = true;

    // Phase 1: Immediately render live parcels synchronously so 3D buildings appear on frame 1!
    const initialFeatures = (this.parcels || []).map((p, idx) => ({
      type: 'Feature',
      id: idx + 1,
      geometry: { type: 'Polygon', coordinates: [p.coordinates] },
      properties: {
        ...p,
        id: idx + 1,
        height: (p.total_floors || 2) * 3.5,
        base_height: 0
      }
    }));

    const initialGeoJSON = {
      type: 'FeatureCollection',
      features: initialFeatures
    };

    try {
      if (!this.map.getSource('punjab-3d-buildings')) {
        this.map.addSource('punjab-3d-buildings', {
          type: 'geojson',
          data: initialGeoJSON,
          promoteId: 'id'
        });
      }

      if (!this.map.getLayer('3d-buildings-layer')) {
        const beforeLayer = this.map.getLayer('layer-transportation') ? 'layer-transportation' : (this.map.getLayer('layer-labels') ? 'layer-labels' : undefined);
        this.map.addLayer({
          id: '3d-buildings-layer',
          type: 'fill-extrusion',
          source: 'punjab-3d-buildings',
          paint: {
            'fill-extrusion-color': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], '#ffd700', // Gold on hover
              ['==', ['get', 'status'], 'FLAGGED_VIOLATION'], '#ef4444', // Sharp Red for Statutory Violations
              ['any', ['==', ['get', 'status'], 'PENDING_REGISTRATION'], ['==', ['get', 'status'], 'PENDING']], '#f59e0b', // Sharp Amber for Pending Drone LiDAR Surveys
              ['>=', ['coalesce', ['get', 'height'], 7.5], 10.5], '#0284c7', // Multi-storey high-rise cyan-blue
              ['>=', ['coalesce', ['get', 'height'], 7.5], 6.8], '#38bdf8',  // Mid-rise 2-storey slate cyan
              '#cbd5e1' // Single-storey residential warm architectural limestone
            ],
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 7.5],
            'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
            'fill-extrusion-opacity': 0.92
          }
        }, beforeLayer);
      }
    } catch (e) {
      console.warn('Initial 3D buildings setup error handled:', e);
    }

    // Phase 2: Asynchronously load full 10,300 buildings dataset in background and seamlessly enrich map!
    try {
      const resp = await fetch('src/data/punjab_3d_buildings.json');
      if (resp.ok) {
        const fullGeoJSON = await resp.json();
        if (fullGeoJSON && fullGeoJSON.features) {
          fullGeoJSON.features.forEach((f, idx) => {
            if (!f.id) f.id = idx + 1;
            if (!f.properties) f.properties = {};
            if (!f.properties.height) {
              const floors = f.properties.total_floors || ((idx % 4) + 1);
              f.properties.total_floors = floors;
              f.properties.height = floors * 3.4;
            }
          });
          this.currentGeoJSON = fullGeoJSON;
          const src = this.map.getSource('punjab-3d-buildings');
          if (src) {
            src.setData(fullGeoJSON);
          }
        }
      }
    } catch (err) {
      console.warn('Full buildings GeoJSON load error (using live parcels):', err);
    }

    if (this.pendingDatasetKey) {
      const k = this.pendingDatasetKey;
      this.pendingDatasetKey = null;
      this.switchDataset(k);
    }
    if (this.pendingFilter) {
      const f = this.pendingFilter;
      this.pendingFilter = null;
      this.applyFilter(f);
    }
  }

  // Real-time Map Filters (Status, Floors, Violations, Surveys, Tax)
  applyFilter(filterKey) {
    if (!this.map || !this.buildingsLoaded) {
      this.pendingFilter = filterKey;
      return;
    }
    this.currentFilter = filterKey;

    const layerId = '3d-buildings-layer';
    if (!this.map.getLayer(layerId)) return;

    let filterExp = null;
    let label = 'All Buildings';

    switch (filterKey) {
      case 'digitalized':
        filterExp = ['==', ['get', 'status'], 'DIGITALIZED'];
        label = '✅ Digitalized 3D Twins (60%)';
        break;
      case 'anomalies':
        filterExp = ['==', ['get', 'status'], 'FLAGGED_VIOLATION'];
        label = '🚨 AI Height Violations & Anomalies';
        break;
      case 'pending':
        filterExp = ['any', 
          ['==', ['get', 'status'], 'PENDING_REGISTRATION'],
          ['==', ['get', 'status'], 'PENDING']
        ];
        label = '⏳ Pending Drone SLAM Surveys';
        break;
      case 'highrise':
        filterExp = ['>=', ['coalesce', ['get', 'total_floors'], 1], 3];
        label = '🏢 Multi-Storey Buildings (3+ Storeys)';
        break;
      case 'single_floor':
        filterExp = ['<=', ['coalesce', ['get', 'total_floors'], 1], 1];
        label = '🏠 Single-Storey Buildings (Ground Floor)';
        break;
      case 'tax_paid':
        filterExp = ['==', ['get', 'tax_status'], 'PAID'];
        label = '💰 Property Tax Compliant (Paid)';
        break;
      default:
        filterExp = null;
        label = 'All 3,600 Cadastral Buildings';
        break;
    }

    this.map.setFilter(layerId, filterExp);

    if (this.map.getLayer('punjab-parcels-fill')) {
      this.map.setFilter('punjab-parcels-fill', filterExp);
    }

    this.showMapToast(`🔍 Filter Active: ${label}`, 3000);
  }

  // Switch between city-wide / division GeoJSON datasets (e.g. Amritsar, Jalandhar, Ludhiana, Delhi, Chandigarh, Mumbai, Pan-India)
  async switchDataset(datasetKey) {
    if (!this.map || !this.buildingsLoaded) {
      this.pendingDatasetKey = datasetKey;
      return;
    }

    const config = {
      amritsar_core: {
        url: 'src/data/punjab_3d_buildings.json',
        center: [74.8620, 31.6125],
        zoom: 16.5,
        pitch: 58,
        name: 'Amritsar Heritage Core (3,600 Twins • 60% Digitalized)'
      },
      amritsar_full: {
        url: '/punjab_amritsar_buildings.geojson',
        center: [74.8720, 31.6225],
        zoom: 15.5,
        pitch: 60,
        name: 'Amritsar Division (22,300+ Real ML Buildings)'
      },
      jalandhar: {
        url: '/punjab_jalandhar_buildings.geojson',
        center: [75.5650, 31.3150],
        zoom: 15.5,
        pitch: 60,
        name: 'Jalandhar Division (42,800+ Buildings)'
      },
      ludhiana: {
        url: '/punjab_ludhiana_buildings.geojson',
        center: [75.8450, 30.8950],
        zoom: 15.5,
        pitch: 60,
        name: 'Ludhiana Industrial Division (61,900+ Buildings)'
      },
      delhi_nct: {
        center: [77.2090, 28.6139],
        zoom: 15.8,
        pitch: 58,
        name: 'Delhi National Capital Territory (NCT Cadastre)',
        generator: () => this.generateMetroDivisionBuildings([77.2090, 28.6139], 'DL01', 'New Delhi')
      },
      chandigarh: {
        center: [76.7794, 30.7333],
        zoom: 15.8,
        pitch: 58,
        name: 'Chandigarh Tri-City Master Plan',
        generator: () => this.generateMetroDivisionBuildings([76.7794, 30.7333], 'CH01', 'Chandigarh')
      },
      mumbai: {
        center: [72.8777, 19.0760],
        zoom: 15.8,
        pitch: 58,
        name: 'Mumbai Metropolitan Cadastre',
        generator: () => this.generateMetroDivisionBuildings([72.8777, 19.0760], 'MH01', 'Mumbai')
      },
      pan_india: {
        center: [78.9629, 21.5937],
        zoom: 5.2,
        pitch: 25,
        name: 'Pan-India National Cadastre (All 28 States & 8 UTs)',
        generator: () => this.generatePanIndiaStateCadastreFeatures()
      }
    };

    const target = config[datasetKey] || config.amritsar_core;
    this.showMapToast(`⏳ Loading ${target.name}...`);

    try {
      let geojson = null;
      if (target.generator) {
        geojson = target.generator();
      } else if (target.url) {
        const resp = await fetch(target.url);
        geojson = await resp.json();
      }

      if (geojson && geojson.features) {
        geojson.features.forEach((f, idx) => {
          if (!f.id) f.id = idx + 1;
          if (!f.properties) f.properties = {};
          if (!f.properties.height) {
            const floors = f.properties.total_floors || ((idx % 4) + 1);
            f.properties.total_floors = floors;
            f.properties.height = floors * 3.4;
          }
          if (!f.properties.ulpin) {
            const grid = datasetKey.includes('amritsar') ? 'BCN' : datasetKey === 'jalandhar' ? 'BJL' : datasetKey === 'ludhiana' ? 'BLD' : 'BPH';
            const block = String(501 + (idx % 8)).padStart(3, '0');
            const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const hash = Math.abs((idx * 1337 + 8921) % (36 * 36 * 36 * 36));
            const c1 = B36[Math.floor(hash / (36 * 36 * 36)) % 36];
            const c2 = B36[Math.floor(hash / (36 * 36)) % 36];
            const c3 = B36[Math.floor(hash / 36) % 36];
            const c4 = B36[hash % 36];
            const p1 = B36[(idx * 7 + 12) % 36];
            const p2 = B36[(idx * 13 + 34) % 36];
            const k1 = B36[(idx * 19 + 56) % 36];
            const k2 = B36[(idx * 23 + 78) % 36];
            f.properties.ulpin = `${grid}${block}${c1}${c2}${c3}${c4}${p1}${p2}${k1}${k2}`;
          }
        });
      }

      this.currentGeoJSON = geojson;
      if (this.map && typeof this.map.getSource === 'function') {
        const source = this.map.getSource('punjab-3d-buildings');
        if (source && geojson) {
          source.setData(geojson);
        }
      }

      if (this.map && typeof this.map.flyTo === 'function') {
        this.map.flyTo({
          center: target.center,
          zoom: target.zoom,
          pitch: target.pitch,
          bearing: -20,
          duration: 2000
        });
      }

      const count = geojson && geojson.features ? geojson.features.length.toLocaleString() : '3D';
      this.showMapToast(`✅ Active: ${count} 3D Buildings in ${target.name}!`, 3500);
    } catch (err) {
      console.error('Dataset switch error:', err);
      this.showMapToast(`❌ Error loading dataset: ${err.message}`, 4000);
    }
  }

  generateMetroDivisionBuildings(center, prefix, cityName) {
    const [cLng, cLat] = center;
    const features = [];
    const count = 350;
    const owners = ['Rajesh Sharma', 'Sunita Verma', 'Amitabh Gupta', 'Pooja Iyer', 'Vikramaditya Roy', 'Ananya Deshmukh', 'Kiran Patel', 'Ramesh Nair'];
    const localities = ['Central Business District', 'Civil Lines', 'Tech Park Corridor', 'Heritage Circle', 'Sector 17', 'Ring Road Complex'];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 8;
      const radius = 0.003 + (i / count) * 0.018;
      const lng = cLng + Math.cos(angle) * radius + (Math.sin(i * 13) * 0.001);
      const lat = cLat + Math.sin(angle) * radius * 0.85 + (Math.cos(i * 17) * 0.001);

      const w = 0.00035 + (i % 5) * 0.00008;
      const h = 0.00030 + (i % 4) * 0.00009;

      const floors = (i % 6) + 1;
      const isDigi = (i % 10) < 6; // 60% digitalized
      const isFlag = !isDigi && (i % 10 < 8);

      features.push({
        type: 'Feature',
        id: i + 1,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lng - w / 2, lat - h / 2],
            [lng + w / 2, lat - h / 2],
            [lng + w / 2, lat + h / 2],
            [lng - w / 2, lat + h / 2],
            [lng - w / 2, lat - h / 2]
          ]]
        },
        properties: {
          id: i + 1,
          ulpin: `${prefix}-${String(8600 + (i % 39))}-${String(1000 + i * 7)}`,
          survey_no: `Khasra No. ${100 + i}/1, ${localities[i % localities.length]}`,
          owner: owners[i % owners.length],
          total_floors: floors,
          declared_floors: floors,
          height: floors * 3.4,
          height_ft: (floors * 3.4 * 3.28084).toFixed(1),
          status: isDigi ? 'DIGITALIZED' : isFlag ? 'FLAGGED_VIOLATION' : 'PENDING_REGISTRATION',
          has_anomaly: isFlag,
          anomaly_desc: isFlag ? 'Declared 2 Floors; Drone SLAM detected 3 Levels (+3.2m height excess).' : null,
          locality: localities[i % localities.length],
          tehsil: `${cityName} Urban`,
          district: `${cityName}`,
          area_sqyd: 280 + (i % 12) * 45,
          area_sqft: (280 + (i % 12) * 45) * 9,
          built_up_sqft: (280 + (i % 12) * 45) * 9 * (floors * 0.85),
          far: (1.2 + (floors * 0.5)).toFixed(2),
          centroid: [lat, lng],
          tax_amount: 12000 + floors * 4500,
          tax_status: 'PAID'
        }
      });
    }

    return { type: 'FeatureCollection', features };
  }

  generatePanIndiaStateCadastreFeatures() {
    const states = [
      { name: 'Punjab', center: [75.3412, 31.1471], code: 'PB' },
      { name: 'Delhi NCT', center: [77.2090, 28.6139], code: 'DL' },
      { name: 'Maharashtra', center: [73.8567, 18.5204], code: 'MH' },
      { name: 'Karnataka', center: [77.5946, 12.9716], code: 'KA' },
      { name: 'Tamil Nadu', center: [80.2707, 13.0827], code: 'TN' },
      { name: 'Gujarat', center: [72.5714, 23.0225], code: 'GJ' },
      { name: 'West Bengal', center: [88.3639, 22.5726], code: 'WB' },
      { name: 'Rajasthan', center: [75.7873, 26.9124], code: 'RJ' },
      { name: 'Uttar Pradesh', center: [80.9462, 26.8467], code: 'UP' },
      { name: 'Telangana', center: [78.4867, 17.3850], code: 'TS' }
    ];

    const features = [];
    let idCounter = 1;

    states.forEach(st => {
      const [cLng, cLat] = st.center;
      for (let j = 0; j < 30; j++) {
        const dLng = (Math.random() - 0.5) * 0.06;
        const dLat = (Math.random() - 0.5) * 0.06;
        const w = 0.0015;
        const h = 0.0012;
        const lng = cLng + dLng;
        const lat = cLat + dLat;
        const floors = (j % 5) + 2;

        features.push({
          type: 'Feature',
          id: idCounter++,
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [lng - w, lat - h],
              [lng + w, lat - h],
              [lng + w, lat + h],
              [lng - w, lat + h],
              [lng - w, lat - h]
            ]]
          },
          properties: {
            id: idCounter,
            ulpin: `${st.code}01-${String(8600 + j)}-${String(2000 + j * 9)}`,
            survey_no: `Khasra No. ${j + 10}/1`,
            owner: `State Landholder (${st.name})`,
            total_floors: floors,
            height: floors * 3.4,
            status: j % 2 === 0 ? 'DIGITALIZED' : 'PENDING_REGISTRATION',
            locality: `${st.name} Metropolitan Area`,
            tehsil: `${st.name} District`,
            district: st.name,
            area_sqyd: 450,
            area_sqft: 4050,
            centroid: [lat, lng],
            tax_amount: 18500,
            tax_status: 'PAID'
          }
        });
      }
    });

    return { type: 'FeatureCollection', features };
  }

  flyToLocation(target) {
    if (!this.map || !target) return;
    this.map.flyTo({
      center: target.center,
      zoom: target.zoom || 16,
      pitch: target.pitch !== undefined ? target.pitch : 55,
      bearing: target.bearing !== undefined ? target.bearing : -20,
      duration: 1800,
      essential: true
    });
    if (target.name) {
      this.showMapToast(`📍 Navigated to: ${target.name}`, 3500);
    }
  }

  // Add a newly registered building directly to the active 3D map layer
  addNewBuildingToMap(parcel) {
    if (!this.currentGeoJSON || !this.currentGeoJSON.features) return;

    const newFeature = {
      type: 'Feature',
      id: this.currentGeoJSON.features.length + 1,
      geometry: {
        type: 'Polygon',
        coordinates: [parcel.coordinates]
      },
      properties: {
        ...parcel,
        id: this.currentGeoJSON.features.length + 1,
        height: (parcel.total_floors || 2) * 3.5,
        base_height: 0
      }
    };

    this.currentGeoJSON.features.push(newFeature);
    const source = this.map.getSource('punjab-3d-buildings');
    if (source) {
      source.setData(this.currentGeoJSON);
    }

    if (parcel.centroid) {
      this.flyToParcel(parcel);
    }
    this.showMapToast(`🏢 New Building ${parcel.ulpin} added & extruded on 3D Map!`, 4000);
  }

  // On-Map Floating Status Toast
  showMapToast(message, duration = 3000) {
    const toast = document.getElementById('map-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.style.display = 'block';

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    if (duration > 0) {
      this.toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
      }, duration);
    }
  }


  setupInteractions() {
    // 3D Mouse Hover: Highlights building in gold & displays 14-digit ULPIN tag
    this.map.on('mousemove', '3d-buildings-layer', (e) => {
      if (this.pickerMode) return;
      if (e.features && e.features.length > 0) {
        this.map.getCanvas().style.cursor = 'pointer';

        const feature = e.features[0];
        const props = feature.properties;

        if (this.hoveredBuildingId !== null) {
          this.map.setFeatureState(
            { source: 'punjab-3d-buildings', id: this.hoveredBuildingId },
            { hover: false }
          );
        }

        this.hoveredBuildingId = feature.id;
        this.hoveredFeature = feature;
        this.map.setFeatureState(
          { source: 'punjab-3d-buildings', id: this.hoveredBuildingId },
          { hover: true }
        );

        this.showHoverHud(props, e, feature);
      }
    });

    this.map.on('mouseleave', '3d-buildings-layer', () => {
      if (this.pickerMode) return;
      this.map.getCanvas().style.cursor = '';
      if (this.hoveredBuildingId !== null) {
        this.map.setFeatureState(
          { source: 'punjab-3d-buildings', id: this.hoveredBuildingId },
          { hover: false }
        );
      }
      this.hoveredBuildingId = null;
      setTimeout(() => {
        if (this.hoveredBuildingId === null) {
          this.hoveredFeature = null;
          this.hideHoverHud();
        }
      }, 300);
    });

    // 1. Direct Layer Click on 3D Extruded Buildings - Native Raycaster Hit
    this.map.on('click', '3d-buildings-layer', (e) => {
      if (this.pickerMode) {
        this.handlePickerClick(e);
        return;
      }
      if (e.features && e.features.length > 0) {
        this.handleBuildingClick(e.features[0]);
      }
    });

    // 2. Click on the Hover HUD itself also opens 3D Inspector!
    if (this.hoverHud) {
      this.hoverHud.onclick = (e) => {
        e.stopPropagation();
        if (this.hoveredFeature) {
          this.handleBuildingClick(this.hoveredFeature);
        }
      };
    }

    // 3. Fallback Map-level Click with tolerance bbox & hoveredFeature fallback
    this.map.on('click', (e) => {
      if (this.pickerMode) {
        this.handlePickerClick(e);
        return;
      }

      if (this.hoveredFeature) {
        this.handleBuildingClick(this.hoveredFeature);
        return;
      }

      const bbox = [
        [e.point.x - 14, e.point.y - 14],
        [e.point.x + 14, e.point.y + 14]
      ];
      const features = this.map.queryRenderedFeatures(bbox, { layers: ['3d-buildings-layer'] });
      if (features && features.length > 0) {
        this.handleBuildingClick(features[0]);
      }
    });
  }

  handleBuildingClick(feature) {
    if (!feature) return;
    const props = feature.properties || {};
    this.hideHoverHud();

    // Extract exact outer boundary polygon coordinates from the clicked feature
    let coords = null;
    if (feature.geometry) {
      if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates) {
        coords = feature.geometry.coordinates[0];
      } else if (feature.geometry.type === 'MultiPolygon' && feature.geometry.coordinates) {
        coords = feature.geometry.coordinates[0][0];
      }
    }

    if (!coords || coords.length < 3) {
      coords = [
        [74.8620, 31.6125],
        [74.8626, 31.6125],
        [74.8626, 31.6131],
        [74.8620, 31.6131],
        [74.8620, 31.6125]
      ];
    }

    // Find matching parcel or construct full parcel object with coordinates
    let parcel = (this.parcels || []).find(p => p.ulpin === props.ulpin);
    if (!parcel) {
      parcel = this.createDynamicParcelFromProps(props, coords);
    } else {
      // Clone parcel and sync exact coordinates from the clicked map feature
      parcel = { ...parcel, coordinates: coords };
    }

    // Open 3D Blueprint Digital Twin immediately
    if (this.onSelectParcel) {
      this.onSelectParcel(parcel);
    }
  }

  // Switch Map Layer: 'satellite' or 'street' (Topo removed as requested)
  setBaseLayer(layerName) {
    if (!this.map) return;
    this.currentBaseLayer = layerName;

    const isSat = layerName === 'satellite';
    const isStreet = layerName === 'street';

    this.map.setLayoutProperty('layer-satellite', 'visibility', isSat ? 'visible' : 'none');
    this.map.setLayoutProperty('layer-transportation', 'visibility', isSat ? 'visible' : 'none');
    this.map.setLayoutProperty('layer-street', 'visibility', isStreet ? 'visible' : 'none');
    this.map.setLayoutProperty('layer-labels', 'visibility', isSat ? 'visible' : 'none');

    const btnSat = document.getElementById('btn-layer-satellite');
    const btnStr = document.getElementById('btn-layer-street');
    if (btnSat) btnSat.classList.toggle('active', isSat);
    if (btnStr) btnStr.classList.toggle('active', isStreet);
  }

  showHoverHud(props, e, feature) {
    if (!this.hoverHud) return;

    const statusHtml = props.status === 'FLAGGED_VIOLATION'
      ? '<span style="color: #f87171; font-weight: 700;">🚨 AI ANOMALY (24H NOTICE)</span>'
      : (props.status === 'PENDING_REGISTRATION' || props.status === 'PENDING')
      ? '<span style="color: #fbbf24; font-weight: 700;">⏳ PENDING DRONE SLAM SURVEY</span>'
      : '<span style="color: #4ade80; font-weight: 700;">✅ DIGITALIZED 3D TWIN</span>';

    // Extract exact GPS coordinates
    let lat = 31.6125, lng = 74.8620;
    if (props.centroid) {
      const c = Array.isArray(props.centroid) ? props.centroid : (typeof props.centroid === 'string' ? JSON.parse(props.centroid) : props.centroid);
      if (c && c[0] > 60) { lng = Number(c[0]); lat = Number(c[1]); }
      else if (c) { lat = Number(c[0]); lng = Number(c[1]); }
    } else if (e.lngLat) {
      lat = e.lngLat.lat;
      lng = e.lngLat.lng;
    }

    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;

    // Detailed floor breakdown
    const floors = parseInt(props.total_floors, 10) || 3;
    const heightM = props.height || (floors * 3.4).toFixed(1);
    const heightFt = props.height_ft || (heightM * 3.28084).toFixed(1);
    const areaSqft = props.area_sqft || Math.round((props.area_sqyd || 385) * 9);
    const builtUpSqft = props.built_up_sqft || Math.round(areaSqft * (floors * 0.82));
    const farText = props.far ? `&bull; FAR ${props.far}` : '';
    const areaText = props.area_sqyd ? `${props.area_sqyd} sq.yd (${areaSqft} sq.ft)` : '385 sq.yd';

    let floorsHtml = `<div class="hud-floors-detail">
      <div style="font-weight: 700; color: #38bdf8; margin-bottom: 3px;">🏢 Floor Specs (${floors} Levels &bull; ${heightM}m / ${heightFt}ft):</div>
      <div>&bull; Ground Level (3.2m): Stilt Lobby &amp; Parking (~${Math.round(areaSqft * 0.85)} sq.ft)</div>`;
    for (let f = 1; f < floors; f++) {
      floorsHtml += `<div>&bull; Level ${f} (3.0m): Unit Space (~${Math.round(areaSqft * 0.88)} sq.ft)</div>`;
    }
    floorsHtml += `</div>`;

    const bhu = window.app && window.app.getBhuNakshaRecord ? window.app.getBhuNakshaRecord(props) : {
      district: props.district || 'Amritsar',
      tehsil: props.tehsil || 'Amritsar-I',
      hadbastNo: '101',
      khasraNo: (props.survey_no || 'Khasra No. 412/1').replace(/Khasra No\.\s*/i, ''),
      khewatNo: '88',
      kanalMarla: '0 Kanal 7 Marla (' + areaText + ')'
    };

    this.hoverHud.innerHTML = `
      <div class="hud-header">Department of Land Resources &bull; Bhu-Aadhaar</div>
      <div class="hud-ulpin">${props.ulpin || 'BCN501B1NA2CH0'}</div>

      <!-- BhuNaksha Live Sync Banner -->
      <div class="hud-bhunaksha-banner">
        <span>🏛️ BhuNaksha: Hadbast #${bhu.hadbastNo} &bull; Khasra #${bhu.khasraNo}</span>
        <button type="button" class="hud-btn-copy" onclick="event.stopPropagation(); window.app && window.app.copyBhuNakshaDetails('${props.ulpin}')">
          📋 Copy Record
        </button>
      </div>

      <div class="hud-meta">
        <div><strong>Khasra No (ਖਸਰਾ ਨੰ:):</strong> <span style="font-family: monospace; font-weight: 700; color: #0284c7;">Khasra No. ${bhu.khasraNo}</span></div>
        <div><strong>Owner (ਮਾਲਕ):</strong> ${props.owner || 'Citizen Landowner'}</div>
        <div><strong>Village / Hadbast:</strong> ${bhu.village || props.locality || 'Kot Atma Singh'} (Hadbast #${bhu.hadbastNo})</div>
        <div><strong>District &amp; Tehsil:</strong> ${bhu.district} &bull; ${bhu.tehsil}</div>
        <div><strong>Cadastral Area (ਰਕਬਾ):</strong> ${bhu.kanalMarla}</div>
        <div><strong>GPS Location:</strong> <span style="font-family: monospace;">${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E</span></div>
        ${floorsHtml}
        <div><strong>Status:</strong> ${statusHtml}</div>
        <div style="display: flex; gap: 6px; margin-top: 5px;">
          <a href="${gmapsUrl}" target="_blank" class="hud-gmaps-link" style="flex: 1;" onclick="event.stopPropagation()">
            <span>📍</span> Google Maps ↗
          </a>
          <a href="https://jamabandi.punjab.gov.in/" target="_blank" class="hud-gmaps-link" style="flex: 1; color: #15803d; border-color: #86efac; background: #f0fdf4;" onclick="event.stopPropagation()">
            <span>🌐</span> jamabandi.punjab.gov.in ↗
          </a>
        </div>
      </div>
      <div class="hud-hint">⚡ Click Building to Open 3D Inspector &amp; BhuNaksha RoR &rarr;</div>
    `;

    // Position directly beside cursor using native container-relative coordinates
    const container = this.map.getContainer();
    const mapWidth = container.clientWidth;
    const mapHeight = container.clientHeight;

    const hudWidth = 330;
    const hudHeight = 260;

    let posX = e.point.x + 18;
    let posY = e.point.y - 140;

    // Strict clamping within map viewport bounds
    if (posX + hudWidth > mapWidth - 15) {
      posX = e.point.x - hudWidth - 18;
    }
    if (posY < 15) {
      posY = e.point.y + 20;
    }
    if (posY + hudHeight > mapHeight - 15) {
      posY = mapHeight - hudHeight - 15;
    }

    posX = Math.max(15, posX);
    posY = Math.max(15, posY);

    this.hoverHud.style.display = 'block';
    this.hoverHud.style.left = `${posX}px`;
    this.hoverHud.style.top = `${posY}px`;
  }

  hideHoverHud() {
    if (this.hoverHud) {
      this.hoverHud.style.display = 'none';
    }
  }

  createDynamicParcelFromProps(props, coords) {
    const floors = parseInt(props.total_floors, 10) || 3;
    const ulpin = props.ulpin || 'BCN501B1NA2CH0';
    const owner = props.owner || 'Citizen Landowner';

    const levels = [];
    // -30ft Subterranean
    levels.push({
      level_code: 'B30',
      sub_ulpin: `${ulpin}-B30-UTL`,
      name: 'Subterranean Foundation (-30 ft / -9.14 m)',
      depth_feet: -30.0,
      is_subterranean: true,
      owner: 'Government / Municipal Corporation of Amritsar (MCA)',
      carpet_area_sqft: 1200,
      utilities: [
        { type: 'High Voltage Electric Conduits', color: '#ff3344', status: 'ACTIVE', meter: 'PSPCL-HT-449' },
        { type: 'Municipal Water Line (Inlet)', color: '#00bbff', status: 'ACTIVE', meter: 'MCA-W-8812' },
        { type: 'Main Sewerage Outflow', color: '#cc7722', status: 'ACTIVE', meter: 'MCA-SEW-091' },
        { type: 'Piped Natural Gas (PNG)', color: '#eab308', status: 'ACTIVE', meter: 'MCA-GAS-112' },
        { type: 'Optical Fiber Telecom Trunk', color: '#10b981', status: 'ACTIVE', meter: 'BSNL-OFC-789' }
      ]
    });

    // Ground floor
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

    for (let f = 1; f <= floors; f++) {
      levels.push({
        level_code: `F0${f}`,
        sub_ulpin: `${ulpin}-F0${f}-U01`,
        name: `Level ${f} - Residential Unit`,
        height_m: 3.0,
        is_subterranean: false,
        owner: owner,
        carpet_area_sqft: 1200 - f * 40,
        tax_status: 'PAID',
        is_flagged: props.status === 'FLAGGED_VIOLATION' && f === floors
      });
    }

    return {
      id: props.id,
      ulpin: ulpin,
      owner: owner,
      status: props.status || 'DIGITALIZED',
      khata: props.khata || 'KH-2024/782',
      survey_no: props.survey_no || 'Khasra No. 412/1',
      total_floors: floors,
      declared_floors: props.declared_floors || floors,
      has_anomaly: props.status === 'FLAGGED_VIOLATION' || props.has_anomaly,
      anomaly_desc: props.anomaly_desc || (props.status === 'FLAGGED_VIOLATION' ? 'Declared G+1; 3D LiDAR SLAM detected G+2 (+3.2m height excess).' : null),
      tax_status: props.tax_status || 'PAID',
      tax_amount: props.tax_amount || 14200,
      area_sqyd: props.area_sqyd,
      area_sqft: props.area_sqft,
      area_sqm: props.area_sqm,
      built_up_sqft: props.built_up_sqft,
      far: props.far,
      height: props.height,
      height_ft: props.height_ft,
      perimeter_m: props.perimeter_m,
      perimeter_ft: props.perimeter_ft,
      electric_meter: props.electric_meter,
      water_meter: props.water_meter,
      centroid: props.centroid,
      vertex_count: props.vertex_count,
      locality: props.locality,
      tehsil: props.tehsil || "Amritsar-I (Urban)",
      district: props.district || "Amritsar, Punjab",
      coordinates: coords,
      levels: levels,
      registration_date: '18-Aug-2021'
    };
  }

  flyToParcel(parcel) {
    if (!parcel) return;

    // 1. Asynchronous load safety: if map is initializing or style is loading, queue and wait for 'load'
    if (!this.map || !this.map.loaded()) {
      this.pendingFlyToParcel = parcel;
      if (this.map) {
        this.map.once('load', () => this.flyToParcel(parcel));
      }
      return;
    }

    // 2. Robust centroid & coordinate extraction
    let targetLng = 74.8620, targetLat = 31.6125;
    if (parcel.centroid && Array.isArray(parcel.centroid)) {
      const v0 = Number(parcel.centroid[0]);
      const v1 = Number(parcel.centroid[1]);
      if (v0 > 60 && v0 < 100) { targetLng = v0; targetLat = v1; }
      else { targetLat = v0; targetLng = v1; }
    } else if (parcel.coordinates && parcel.coordinates.length > 0) {
      let sumLng = 0, sumLat = 0, count = 0;
      const pts = Array.isArray(parcel.coordinates[0]) && Array.isArray(parcel.coordinates[0][0])
        ? parcel.coordinates[0]
        : parcel.coordinates;
      pts.forEach(c => {
        if (Array.isArray(c) && typeof c[0] === 'number') {
          sumLng += c[0];
          sumLat += c[1];
          count++;
        }
      });
      if (count > 0) {
        targetLng = sumLng / count;
        targetLat = sumLat / count;
      }
    }

    // 3. Highlight the 3D building extrusion itself in vibrant cyan
    this.locatedUlpin = parcel.ulpin;
    if (this.map.getLayer('3d-buildings-layer')) {
      this.map.setPaintProperty('3d-buildings-layer', 'fill-extrusion-color', [
        'case',
        ['==', ['get', 'ulpin'], this.locatedUlpin || '___none___'], '#00f2fe',
        ['boolean', ['feature-state', 'hover'], false], '#ffd700',
        ['==', ['get', 'status'], 'FLAGGED_VIOLATION'], '#ef4444',
        ['any', ['==', ['get', 'status'], 'PENDING_REGISTRATION'], ['==', ['get', 'status'], 'PENDING']], '#f59e0b',
        ['>=', ['coalesce', ['get', 'height'], 7.5], 10.5], '#0284c7',
        ['>=', ['coalesce', ['get', 'height'], 7.5], 6.8], '#38bdf8',
        '#cbd5e1'
      ]);
    }

    // 4. Zoom tightly into the located building close-up (NOT the entire map)
    this.map.flyTo({
      center: [targetLng, targetLat],
      zoom: 17.6,
      pitch: 58,
      bearing: -22,
      duration: 1200,
      essential: true
    });

    // 5. High-visibility animated beacon marker on the located building
    if (this.locatedMarker) {
      this.locatedMarker.remove();
    }
    const beaconEl = document.createElement('div');
    beaconEl.className = 'cadastral-beacon-marker';
    beaconEl.innerHTML = `
      <div class="beacon-pulse-ring"></div>
      <div class="beacon-pin">📍</div>
      <div class="beacon-label">${parcel.survey_no || parcel.ulpin}</div>
    `;
    this.locatedMarker = new maplibregl.Marker({ element: beaconEl, anchor: 'bottom' })
      .setLngLat([targetLng, targetLat])
      .addTo(this.map);

    // 6. Highlight the building polygon boundary with glowing outline
    if (!this.map.getSource('located-building-source')) {
      this.setupDrawingLayers();
    }
    if (parcel.coordinates && this.map.getSource('located-building-source')) {
      let ring = Array.isArray(parcel.coordinates[0]) && Array.isArray(parcel.coordinates[0][0])
        ? parcel.coordinates[0]
        : parcel.coordinates;
      const closed = ring.map(c => [c[0], c[1]]);
      if (closed.length >= 3) {
        const first = closed[0];
        const last = closed[closed.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          closed.push([first[0], first[1]]);
        }
      }
      this.map.getSource('located-building-source').setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [closed] },
          properties: {}
        }]
      });
    }

    // 7. Display the interactive HUD right above the located building
    setTimeout(() => {
      const container = this.map.getContainer();
      this.showHoverHud({
        ulpin: parcel.ulpin,
        survey_no: parcel.survey_no,
        owner: parcel.owner,
        total_floors: parcel.total_floors || 3,
        height: (parcel.total_floors || 3) * 3.4,
        status: parcel.status || 'DIGITALIZED'
      }, {
        point: { x: container.clientWidth / 2, y: Math.max(70, container.clientHeight / 2 - 90) }
      });
    }, 1250);

    this.showMapToast(`📍 Located Building: ${parcel.survey_no || parcel.ulpin} • ${parcel.owner || 'Verified Landholder'}`, 5000);
  }

  flyToJurisdiction(center, zoom = 15.5) {
    if (!this.map || !center) return;
    this.map.flyTo({
      center: center,
      zoom: zoom,
      pitch: 52,
      bearing: -15,
      duration: 1600,
      essential: true
    });
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => {
        this.map.resize();
      }, 50);
    }
  }

  setupFloatingControls() {
    const btnZoomIn = document.getElementById('btn-map-zoom-in');
    const btnZoomOut = document.getElementById('btn-map-zoom-out');
    const btnToggle3D = document.getElementById('btn-map-toggle-3d');
    const btnLocateMe = document.getElementById('btn-map-locate-me');
    const btnOverview = document.getElementById('btn-map-full-extent');

    if (btnZoomIn) {
      btnZoomIn.onclick = () => {
        if (this.map) this.map.zoomIn();
      };
    }
    if (btnZoomOut) {
      btnZoomOut.onclick = () => {
        if (this.map) this.map.zoomOut();
      };
    }
    if (btnToggle3D) {
      btnToggle3D.onclick = () => {
        if (!this.map) return;
        const currentPitch = this.map.getPitch();
        if (currentPitch > 15) {
          // Flatten to top-down 2D cadastre map
          this.map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
          btnToggle3D.textContent = '🗺️';
          btnToggle3D.title = 'Switch to 3D Perspective';
        } else {
          // Tilt up to 3D skyline perspective
          this.map.easeTo({ pitch: 60, bearing: -22, duration: 800 });
          btnToggle3D.textContent = '🧭';
          btnToggle3D.title = 'Switch to 2D Top-Down Cadastre';
        }
      };
    }
    if (btnLocateMe) {
      btnLocateMe.onclick = () => {
        if (this.parcels && this.parcels.length > 0) {
          this.flyToParcel(this.parcels[0]);
        }
      };
    }
    if (btnOverview) {
      btnOverview.onclick = () => {
        if (!this.map) return;
        // Fly to broad Punjab State Overview
        this.map.flyTo({
          center: [75.3412, 31.1471],
          zoom: 7.5,
          pitch: 0,
          bearing: 0,
          duration: 1500
        });
      };
    }
    this.updateZoomBadge();
  }

  updateZoomBadge() {
    const badge = document.getElementById('map-zoom-badge');
    if (!badge || !this.map) return;
    const z = this.map.getZoom();
    let label = `${z.toFixed(1)}x`;
    if (z >= 18) label += ' • Building';
    else if (z >= 15) label += ' • Mohalla';
    else if (z >= 12) label += ' • Tehsil';
    else if (z >= 8) label += ' • State';
    else label += ' • India';
    badge.textContent = label;
  }

  setupDrawingLayers() {
    if (!this.map) return;

    // Drawing source for active polygon vertices & lines
    if (!this.map.getSource('cadastral-draw-source')) {
      this.map.addSource('cadastral-draw-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Polygon Fill (semi-transparent emerald green)
      this.map.addLayer({
        id: 'cadastral-draw-fill',
        type: 'fill',
        source: 'cadastral-draw-source',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.4
        }
      });

      // Outline Line (glowing gold)
      this.map.addLayer({
        id: 'cadastral-draw-line',
        type: 'line',
        source: 'cadastral-draw-source',
        paint: {
          'line-color': '#fbbf24',
          'line-width': 3.5,
          'line-dasharray': [2, 1]
        }
      });

      // Vertices Points (bright cyan circles)
      this.map.addLayer({
        id: 'cadastral-draw-points',
        type: 'circle',
        source: 'cadastral-draw-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#0284c7',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    // Located Building Highlight Source & Layers
    if (!this.map.getSource('located-building-source')) {
      this.map.addSource('located-building-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      this.map.addLayer({
        id: 'located-building-fill',
        type: 'fill',
        source: 'located-building-source',
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0.45
        }
      });

      this.map.addLayer({
        id: 'located-building-glow',
        type: 'line',
        source: 'located-building-source',
        paint: {
          'line-color': '#00f2fe',
          'line-width': 4.5
        }
      });
    }
  }

  bindToolbarButtons() {
    const btnSatellite = document.getElementById('btn-layer-satellite');
    const btnStreet = document.getElementById('btn-layer-street');
    if (btnSatellite) btnSatellite.addEventListener('click', () => this.setBaseLayer('satellite'));
    if (btnStreet) btnStreet.addEventListener('click', () => this.setBaseLayer('street'));
  }

  setupFloatingControls() {
    const btnZoomIn = document.getElementById('btn-map-zoom-in');
    const btnZoomOut = document.getElementById('btn-map-zoom-out');
    const btnReset = document.getElementById('btn-map-reset-cam');
    const btnSat = document.getElementById('btn-mode-satellite-ctrl');
    const btnReal = document.getElementById('btn-mode-realistic-ctrl');
    const btnMeasure = document.getElementById('btn-map-measure');

    if (btnZoomIn) {
      btnZoomIn.onclick = () => this.map.zoomIn();
    }
    if (btnZoomOut) {
      btnZoomOut.onclick = () => this.map.zoomOut();
    }
    if (btnReset) {
      btnReset.onclick = () => {
        this.map.flyTo({
          center: [74.8620, 31.6125],
          zoom: 16.5,
          pitch: 58,
          bearing: -24,
          essential: true
        });
      };
    }
    if (btnSat) {
      btnSat.onclick = () => {
        this.setBaseLayer('satellite');
        btnSat.classList.add('active');
        if (btnReal) btnReal.classList.remove('active');
      };
    }
    if (btnReal) {
      btnReal.onclick = () => {
        this.setRealistic3DMode();
        btnReal.classList.add('active');
        if (btnSat) btnSat.classList.remove('active');
      };
    }
    if (btnMeasure) {
      btnMeasure.onclick = () => {
        if (window.app && window.app.startDrawBoundaryPolygon) {
          window.app.startDrawBoundaryPolygon();
        }
      };
    }
  }

  setRealistic3DMode() {
    this.setBaseLayer('satellite');
    if (this.map) {
      this.map.easeTo({
        pitch: 62,
        bearing: -32,
        zoom: Math.max(this.map.getZoom(), 17.2),
        duration: 800
      });
      if (this.map.getLayer('3d-buildings-layer')) {
        this.map.setLayoutProperty('3d-buildings-layer', 'visibility', 'visible');
      }
    }
  }

  startCadastralPicker(mode, onComplete, onCancel) {
    if (!this.map) return;
    if (!this.isLoaded && !this.map.isStyleLoaded()) {
      this.map.once('load', () => this.startCadastralPicker(mode, onComplete, onCancel));
      return;
    }

    this.cleanupPicker();
    this.setupDrawingLayers();

    this.pickerMode = mode; // 'draw' or 'select'
    this.pickerCompleteCb = onComplete;
    this.pickerCancelCb = onCancel;
    this.pickerPoints = []; // Array of [lng, lat]
    this.pickerMarkers = []; // HTML DOM markers for numbered dots 1..6

    this.showPickerHud(mode);

    if (mode === 'draw') {
      this.map.getCanvas().style.cursor = 'crosshair';
    } else if (mode === 'select') {
      this.map.getCanvas().style.cursor = 'pointer';
    }
  }

  handlePickerClick(e) {
    if (this.pickerMode === 'draw') {
      this.handleDrawClick(e);
    } else if (this.pickerMode === 'select') {
      this.handleSelectBuildingClick(e);
    }
  }

  handleDrawClick(e) {
    if (this.pickerPoints.length >= 6) {
      this.finishDrawing();
      return;
    }

    const lng = parseFloat(e.lngLat.lng.toFixed(6));
    const lat = parseFloat(e.lngLat.lat.toFixed(6));
    this.pickerPoints.push([lng, lat]);

    const dotIndex = this.pickerPoints.length;

    // Create a numbered pulsating DOM marker on the map for dot 1..6
    const el = document.createElement('div');
    el.className = 'cadastral-dot-marker';
    el.innerHTML = `<span class="dot-num">${dotIndex}</span>`;
    el.title = `Cadastral Vertex ${dotIndex} of 6`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(this.map);
    this.pickerMarkers.push(marker);

    // Update GeoJSON drawing source
    this.updateDrawSource();

    // Update HUD counters
    this.updatePickerHudMetrics();

    // Auto-complete if 6 connecting dots have been placed
    if (this.pickerPoints.length === 6) {
      setTimeout(() => {
        this.finishDrawing();
      }, 350);
    }
  }

  handleSelectBuildingClick(e) {
    // Query building layers at click point (including 3d-buildings-layer)
    const targetLayers = ['3d-buildings-layer', 'punjab-3d-buildings', 'building-polygons-fill', 'cadastre-polygons-layer'].filter(l => this.map.getLayer(l));
    let features = [];
    if (targetLayers.length > 0) {
      features = this.map.queryRenderedFeatures(e.point, { layers: targetLayers });
    }
    if (!features || features.length === 0) {
      features = this.map.queryRenderedFeatures(e.point).filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
    }

    let targetCoords = null;
    let featProps = {};

    if (features && features.length > 0) {
      const feat = features[0];
      featProps = feat.properties || {};
      if (feat.geometry.type === 'Polygon') {
        targetCoords = feat.geometry.coordinates[0];
      } else if (feat.geometry.type === 'MultiPolygon') {
        targetCoords = feat.geometry.coordinates[0][0];
      }
    }

    if (!targetCoords || targetCoords.length < 3) {
      // Create an authentic 6-sided irregular cadastral parcel around clicked coordinate
      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;
      const d = 0.00035;
      targetCoords = [
        [lng - d * 0.8, lat - d],
        [lng + d * 0.6, lat - d * 0.9],
        [lng + d, lat],
        [lng + d * 0.7, lat + d * 0.95],
        [lng - d * 0.5, lat + d],
        [lng - d, lat + d * 0.2],
        [lng - d * 0.8, lat - d]
      ];
    }

    // Clean unique vertices
    const uniquePoints = targetCoords.slice(0, targetCoords.length - 1);
    const area = this.computeGeodesicArea(uniquePoints);
    const centroid = this.computeCentroid(uniquePoints);

    // Highlight selected building with golden-cyan outline and fill
    this.highlightSelectedPolygon(targetCoords);

    // Smoothly pan camera slightly to center selected parcel
    this.map.easeTo({ center: [centroid[1], centroid[0]], duration: 400 });

    const result = {
      type: 'select',
      coordinates: targetCoords,
      vertexCount: uniquePoints.length,
      area_sqyd: area.sqyd,
      area_sqft: area.sqft,
      area_sqm: area.sqm,
      centroid: centroid,
      properties: featProps
    };

    const cb = this.pickerCompleteCb;
    setTimeout(() => {
      this.cleanupPicker();
      if (cb) {
        cb(result);
      }
    }, 450);
  }

  highlightSelectedPolygon(coords) {
    if (this.map.getSource('cadastral-draw-source')) {
      this.map.getSource('cadastral-draw-source').setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: {}
          }
        ]
      });
    }
  }

  updateDrawSource() {
    if (!this.map.getSource('cadastral-draw-source')) return;

    const features = [];
    // Points
    this.pickerPoints.forEach((pt, idx) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: { index: idx + 1 }
      });
    });

    // Line connecting points
    if (this.pickerPoints.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: this.pickerPoints },
        properties: {}
      });
    }

    // Polygon if 3 or more points
    if (this.pickerPoints.length >= 3) {
      const closed = [...this.pickerPoints, this.pickerPoints[0]];
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [closed] },
        properties: {}
      });
    }

    this.map.getSource('cadastral-draw-source').setData({
      type: 'FeatureCollection',
      features: features
    });
  }

  finishDrawing() {
    if (this.pickerPoints.length < 3) {
      alert('Please click at least 3 points on the map to define your parcel shape.');
      return;
    }

    const closedCoords = [...this.pickerPoints];
    if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
        closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
      closedCoords.push([...closedCoords[0]]);
    }

    const area = this.computeGeodesicArea(this.pickerPoints);
    const centroid = this.computeCentroid(this.pickerPoints);

    const result = {
      type: 'draw',
      coordinates: closedCoords,
      vertexCount: this.pickerPoints.length,
      area_sqyd: area.sqyd,
      area_sqft: area.sqft,
      area_sqm: area.sqm,
      centroid: centroid
    };

    const cb = this.pickerCompleteCb;
    this.cleanupPicker();
    if (cb) {
      cb(result);
    }
  }

  undoLastPoint() {
    if (this.pickerPoints.length > 0) {
      this.pickerPoints.pop();
      const lastMarker = this.pickerMarkers.pop();
      if (lastMarker) lastMarker.remove();
      this.updateDrawSource();
      this.updatePickerHudMetrics();
    }
  }

  cleanupPicker() {
    this.pickerMode = null;
    this.pickerCompleteCb = null;
    this.pickerCancelCb = null;
    if (this.map && this.map.getCanvas()) {
      this.map.getCanvas().style.cursor = '';
    }

    if (this.pickerMarkers) {
      this.pickerMarkers.forEach(m => m.remove());
      this.pickerMarkers = [];
    }

    const hud = document.getElementById('cadastral-picker-hud');
    if (hud) hud.style.display = 'none';
  }

  computeGeodesicArea(coords) {
    if (!coords || coords.length < 3) return { sqyd: 345, sqft: 3105, sqm: 288.5 };
    let area = 0;
    const numPoints = coords.length;
    const rad = Math.PI / 180;
    const R = 6378137;

    for (let i = 0; i < numPoints; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % numPoints];
      const lat1 = p1[1] * rad;
      const lat2 = p2[1] * rad;
      const lng1 = p1[0] * rad;
      const lng2 = p2[0] * rad;
      area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    area = Math.abs(area * (R * R) / 4.0);
    if (area < 10 || isNaN(area)) area = 288.5;

    const sqft = Math.round(area * 10.7639);
    const sqyd = Math.round(sqft / 9.0);
    const sqm = parseFloat(area.toFixed(1));
    return { sqyd, sqft, sqm };
  }

  computeCentroid(coords) {
    if (!coords || coords.length === 0) return [31.61275, 74.86225];
    let sumLng = 0, sumLat = 0;
    coords.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
    const cLat = parseFloat((sumLat / coords.length).toFixed(6));
    const cLng = parseFloat((sumLng / coords.length).toFixed(6));
    return [cLat, cLng];
  }

  showPickerHud(mode) {
    let hud = document.getElementById('cadastral-picker-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'cadastral-picker-hud';
      hud.className = 'cadastral-picker-hud';
      document.body.appendChild(hud);
    }

    const isDraw = mode === 'draw';
    hud.innerHTML = `
      <div class="picker-hud-header">
        <span class="picker-mode-icon">${isDraw ? '✏️' : '📍'}</span>
        <div>
          <strong>${isDraw ? 'Draw Boundary (6 Connecting Dots)' : 'Select Building Footprint'}</strong>
          <div style="font-size: 0.74rem; color: #cbd5e1;">
            ${isDraw ? 'Click 6 corner points on map to shape your land parcel' : 'Click on any building footprint to capture its boundaries'}
          </div>
        </div>
      </div>
      <div class="picker-hud-metrics">
        <div class="picker-pill">
          <span>Dots:</span>
          <strong id="picker-dot-counter">${isDraw ? '0 / 6 points' : 'Click a building'}</strong>
        </div>
        <div class="picker-pill">
          <span>Area:</span>
          <strong id="picker-area-counter" style="color: #4ade80;">0 sq.yd</strong>
        </div>
      </div>
      <div class="picker-hud-actions">
        ${isDraw ? '<button type="button" id="btn-picker-undo" class="btn-picker-sub">↩️ Undo</button>' : ''}
        ${isDraw ? '<button type="button" id="btn-picker-finish" class="btn-picker-done" disabled>✅ Complete</button>' : ''}
        <button type="button" id="btn-picker-cancel" class="btn-picker-cancel">❌ Cancel</button>
      </div>
    `;

    hud.style.display = 'flex';

    if (isDraw) {
      const btnUndo = document.getElementById('btn-picker-undo');
      const btnFinish = document.getElementById('btn-picker-finish');
      if (btnUndo) btnUndo.onclick = () => this.undoLastPoint();
      if (btnFinish) btnFinish.onclick = () => this.finishDrawing();
    }
    const btnCancel = document.getElementById('btn-picker-cancel');
    if (btnCancel) {
      btnCancel.onclick = () => {
        this.cleanupPicker();
        if (this.pickerCancelCb) this.pickerCancelCb();
      };
    }
  }

  updatePickerHudMetrics() {
    const dotCounter = document.getElementById('picker-dot-counter');
    const areaCounter = document.getElementById('picker-area-counter');
    const btnFinish = document.getElementById('btn-picker-finish');

    const count = this.pickerPoints.length;
    if (dotCounter) {
      dotCounter.textContent = `${count} / 6 dots`;
    }

    if (count >= 3) {
      const area = this.computeGeodesicArea(this.pickerPoints);
      if (areaCounter) {
        areaCounter.textContent = `${area.sqyd} sq.yd (${area.sqft} sq.ft)`;
      }
      if (btnFinish) btnFinish.disabled = false;
    } else {
      if (areaCounter) areaCounter.textContent = `0 sq.yd`;
      if (btnFinish) btnFinish.disabled = true;
    }
  }
}

