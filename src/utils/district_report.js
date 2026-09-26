// District Cadastre Report & Analytics Manager
// Handles state/district selection, analytics KPI computation, interactive SVG charts,
// active construction tracking, left sites / disused lands catalogs, and official PDF/CSV exports.

export class DistrictReportManager {
  constructor(app) {
    this.app = app;
    this.currentData = null;
    this.tableFilterChip = 'all';
    this.tableSearchQuery = '';
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.setupEventListeners();
  }

  setupEventListeners() {
    const stateSelect = document.getElementById('report-state-select');
    const districtSelect = document.getElementById('report-district-select');
    const localitySelect = document.getElementById('report-locality-select');
    const btnRefresh = document.getElementById('btn-refresh-report');
    const btnDownloadPdf = document.getElementById('btn-download-report-pdf');
    const btnExportCsv = document.getElementById('btn-export-report-csv');
    const tableSearch = document.getElementById('report-table-search');

    if (stateSelect) {
      stateSelect.addEventListener('change', (e) => {
        this.populateDistrictsForState(e.target.value);
        this.loadReport();
      });
    }

    if (districtSelect) {
      districtSelect.addEventListener('change', () => {
        this.loadReport();
      });
    }

    if (localitySelect) {
      localitySelect.addEventListener('change', () => {
        this.loadReport();
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.loadReport();
      });
    }

    if (btnDownloadPdf) {
      btnDownloadPdf.addEventListener('click', () => {
        this.downloadReportPDF();
      });
    }

    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        this.exportReportCSV();
      });
    }

    if (tableSearch) {
      tableSearch.addEventListener('input', (e) => {
        this.tableSearchQuery = e.target.value.toLowerCase().trim();
        this.applyTableFilter();
      });
    }

    // Filter Chips
    const chips = document.querySelectorAll('.report-filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        chips.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.tableFilterChip = e.currentTarget.getAttribute('data-filter') || 'all';
        this.applyTableFilter();
      });
    });

    // Smooth Disappear Transition When Scrolled Down
    const viewReport = document.getElementById('view-report');
    const ribbon = document.querySelector('.report-control-ribbon');
    const miniPill = document.getElementById('report-mini-reveal-pill');

    if (viewReport && ribbon) {
      let lastScroll = 0;

      viewReport.addEventListener('scroll', () => {
        const currentScroll = viewReport.scrollTop;

        // Near top (within 35px): always keep ribbon visible
        if (currentScroll <= 35) {
          ribbon.classList.remove('ribbon-hidden');
          if (miniPill) miniPill.classList.remove('visible');
          lastScroll = currentScroll;
          return;
        }

        // Scrolling down: smoothly slide up and disappear
        if (currentScroll > lastScroll + 8 && currentScroll > 60) {
          ribbon.classList.add('ribbon-hidden');
          if (miniPill) miniPill.classList.add('visible');
        }
        // Scrolling up: smoothly slide down and reappear
        else if (currentScroll < lastScroll - 8) {
          ribbon.classList.remove('ribbon-hidden');
          if (miniPill) miniPill.classList.remove('visible');
        }

        lastScroll = currentScroll;
      }, { passive: true });

      if (miniPill) {
        miniPill.addEventListener('click', () => {
          ribbon.classList.remove('ribbon-hidden');
          miniPill.classList.remove('visible');
        });
      }
    }
  }

  populateDistrictsForState(state) {
    const districtSelect = document.getElementById('report-district-select');
    if (!districtSelect) return;

    const districtOptions = {
      'Punjab': [
        { value: 'Amritsar', label: 'Amritsar (3,600 Buildings)' },
        { value: 'Ludhiana', label: 'Ludhiana (3,000 Buildings)' },
        { value: 'Jalandhar', label: 'Jalandhar (2,500 Buildings)' },
        { value: 'Phagwara', label: 'Phagwara / Kapurthala (1,200 Buildings)' },
        { value: 'Patiala', label: 'Patiala' },
        { value: 'Mohali', label: 'SAS Nagar (Mohali)' },
        { value: 'Bathinda', label: 'Bathinda' }
      ],
      'Haryana': [
        { value: 'Gurugram', label: 'Gurugram' },
        { value: 'Faridabad', label: 'Faridabad' },
        { value: 'Panchkula', label: 'Panchkula' }
      ],
      'NCT of Delhi': [
        { value: 'New Delhi', label: 'New Delhi' },
        { value: 'Central Delhi', label: 'Central Delhi' },
        { value: 'South Delhi', label: 'South Delhi' }
      ],
      'Chandigarh': [
        { value: 'Chandigarh', label: 'Chandigarh (UT)' }
      ]
    };

    const list = districtOptions[state] || districtOptions['Punjab'];
    districtSelect.innerHTML = list.map(d => `<option value="${d.value}">${d.label}</option>`).join('');
  }

  async loadReport() {
    const state = document.getElementById('report-state-select')?.value || 'Punjab';
    const district = document.getElementById('report-district-select')?.value || 'Amritsar';
    const locality = document.getElementById('report-locality-select')?.value || 'All';

    const loadingIndicator = document.getElementById('report-loading-state');
    const contentArea = document.getElementById('district-report-sheet');

    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (contentArea) contentArea.style.opacity = '0.5';

    try {
      const res = await fetch(`/api/reports/district?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}&locality=${encodeURIComponent(locality)}`);
      const json = await res.json();

      if (json.success && json.report) {
        this.currentData = json.report;
        this.updateLocalityDropdown(json.report.locality_breakdown, locality);
        this.renderReport(json.report);
      } else {
        console.error('Failed to load district report:', json.error);
      }
    } catch (err) {
      console.error('Network error fetching district report:', err);
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      if (contentArea) contentArea.style.opacity = '1';
    }
  }

  updateLocalityDropdown(localities, currentSelected) {
    const select = document.getElementById('report-locality-select');
    if (!select || !localities) return;

    let html = `<option value="All" ${currentSelected === 'All' ? 'selected' : ''}>🌐 All Localities &amp; Wards (${localities.length})</option>`;
    localities.forEach(loc => {
      const isSel = (loc.locality === currentSelected) ? 'selected' : '';
      html += `<option value="${loc.locality}" ${isSel}>${loc.locality} (${loc.total} bldgs)</option>`;
    });
    select.innerHTML = html;
  }

  renderReport(report) {
    // 1. Header Information
    const rId = document.getElementById('report-header-id');
    const rDate = document.getElementById('report-header-date');
    const rJuris = document.getElementById('report-header-jurisdiction');
    const rOfficer = document.getElementById('report-header-officer');

    if (rId) rId.textContent = report.report_id;
    if (rDate) {
      const d = new Date(report.generated_at);
      rDate.textContent = `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (rJuris) {
      rJuris.textContent = `${report.jurisdiction.district} District, ${report.jurisdiction.state} (Ward: ${report.jurisdiction.selected_locality})`;
    }
    if (rOfficer) {
      rOfficer.textContent = report.jurisdiction.competent_officer;
    }

    // 2. Executive Metrics (8 KPI Cards)
    const m = report.metrics;
    this.setText('rep-kpi-total', `${m.total_buildings.toLocaleString()} Buildings`);
    this.setText('rep-kpi-total-sub', `Total Cadastre Footprint: ${(m.total_area_sqyd / 100000).toFixed(2)} Lakh sq.yd`);

    this.setText('rep-kpi-verified', `${m.verified.count.toLocaleString()}`);
    this.setText('rep-kpi-verified-pct', `${m.verified.pct}% of district cadastre`);

    this.setText('rep-kpi-pending', `${m.pending.count.toLocaleString()}`);
    this.setText('rep-kpi-pending-pct', `${m.pending.pct}% awaiting LiDAR scan`);

    this.setText('rep-kpi-anomaly', `${m.anomaly.count.toLocaleString()}`);
    this.setText('rep-kpi-anomaly-pct', `${m.anomaly.pct}% statutory notices active`);

    this.setText('rep-kpi-illegal', `${m.illegal.count.toLocaleString()}`);
    this.setText('rep-kpi-illegal-pct', `${m.illegal.pct}% Sec 187 penalty issued`);

    const lu = m.land_utilization;
    this.setText('rep-kpi-construction', `${lu.under_construction.count.toLocaleString()}`);
    this.setText('rep-kpi-construction-pct', `${lu.under_construction.pct}% (${(lu.under_construction.area_sqyd / 1000).toFixed(1)}k sq.yd)`);

    this.setText('rep-kpi-leftsites', `${lu.left_sites.count.toLocaleString()}`);
    this.setText('rep-kpi-leftsites-pct', `${lu.left_sites.pct}% vacant / unbuilt`);

    this.setText('rep-kpi-active-vs-disused', `Active: ${lu.active_use.count.toLocaleString()} (${lu.active_use.pct}%)`);
    this.setText('rep-kpi-disused-pct', `Disused: ${lu.not_in_use.count.toLocaleString()} (${lu.not_in_use.pct}%)`);

    // 3. Render High-Resolution Pure SVG Interactive Charts
    this.renderVerificationDonutChart(m);
    this.renderLandUtilizationDonutChart(lu);
    this.renderBuildingHeightBarChart(m.typology);
    this.renderLocalityHotspotsChart(report.locality_breakdown);

    // 4. Render Hotspots (Where Construction is Actively Going On)
    this.renderConstructionHotspots(report.active_construction_hotspots);

    // 5. Render Left Sites & Disused Lands Catalogs
    this.renderLeftSitesCatalog(report.left_sites_catalog);
    this.renderDisusedLandsCatalog(report.disused_lands_catalog);

    // 6. Master Table
    this.renderBuildingTable(report.buildings || []);
  }

  setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // --- SVG CHART RENDERERS ---

  renderVerificationDonutChart(metrics) {
    const container = document.getElementById('chart-verification-donut');
    if (!container) return;

    const data = [
      { label: 'Verified & Approved', count: metrics.verified.count, pct: parseFloat(metrics.verified.pct), color: '#16a34a' },
      { label: 'Pending Drone Scan', count: metrics.pending.count, pct: parseFloat(metrics.pending.pct), color: '#f59e0b' },
      { label: 'AI Anomaly (24h Notice)', count: metrics.anomaly.count, pct: parseFloat(metrics.anomaly.pct), color: '#dc2626' },
      { label: 'Illegal Activity', count: metrics.illegal.count, pct: parseFloat(metrics.illegal.pct), color: '#7f1d1d' }
    ];

    container.innerHTML = this.generateDonutSvg(data, 'Verification Status');
  }

  renderLandUtilizationDonutChart(lu) {
    const container = document.getElementById('chart-landuse-donut');
    if (!container) return;

    const data = [
      { label: 'In Active Use', count: lu.active_use.count, pct: parseFloat(lu.active_use.pct), color: '#0284c7' },
      { label: 'Under Construction', count: lu.under_construction.count, pct: parseFloat(lu.under_construction.pct), color: '#8b5cf6' },
      { label: 'Left Sites / Vacant', count: lu.left_sites.count, pct: parseFloat(lu.left_sites.pct), color: '#f97316' },
      { label: 'Disused / Not in Use', count: lu.not_in_use.count, pct: parseFloat(lu.not_in_use.pct), color: '#64748b' }
    ];

    container.innerHTML = this.generateDonutSvg(data, 'Land Utilization');
  }

  generateDonutSvg(slices, centerText) {
    const size = 220;
    const strokeWidth = 32;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    let svgCircles = '';
    slices.forEach(s => {
      const sliceStroke = (s.pct / 100) * circumference;
      const strokeDashoffset = -accumulatedOffset;
      accumulatedOffset += sliceStroke;

      svgCircles += `
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                fill="none" stroke="${s.color}" stroke-width="${strokeWidth}"
                stroke-dasharray="${sliceStroke} ${circumference}"
                stroke-dashoffset="${strokeDashoffset}"
                class="donut-segment"
                data-tooltip="${s.label}: ${s.count.toLocaleString()} (${s.pct}%)" />
      `;
    });

    const legendHtml = slices.map(s => `
      <div class="chart-legend-item">
        <span class="legend-color-box" style="background: ${s.color};"></span>
        <span class="legend-text"><strong>${s.pct}%</strong> ${s.label} <span class="legend-count">(${s.count.toLocaleString()})</span></span>
      </div>
    `).join('');

    return `
      <div class="donut-chart-wrap">
        <div class="donut-svg-container">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-svg">
            ${svgCircles}
            <text x="50%" y="48%" text-anchor="middle" class="donut-center-title">${centerText}</text>
            <text x="50%" y="60%" text-anchor="middle" class="donut-center-sub">100% Audit</text>
          </svg>
        </div>
        <div class="donut-legend-container">
          ${legendHtml}
        </div>
      </div>
    `;
  }

  renderBuildingHeightBarChart(typology) {
    const container = document.getElementById('chart-height-bars');
    if (!container) return;

    const items = [
      { label: 'G0 Single Floor', val: typology.g0_single_floor, color: '#38bdf8' },
      { label: 'G1 Double Storey', val: typology.g1_two_floors, color: '#0284c7' },
      { label: 'G2 Triple Storey', val: typology.g2_three_floors, color: '#1d4ed8' },
      { label: 'G3+ High Rise', val: typology.g3_high_rise, color: '#4338ca' },
      { label: 'Basement Strata', val: typology.basements, color: '#7c3aed' }
    ];

    const maxVal = Math.max(...items.map(i => i.val)) || 1;

    let barsHtml = items.map(item => {
      const pct = Math.round((item.val / maxVal) * 100);
      return `
        <div class="height-bar-row">
          <div class="height-bar-label">${item.label}</div>
          <div class="height-bar-track">
            <div class="height-bar-fill" style="width: ${pct}%; background: ${item.color};"></div>
          </div>
          <div class="height-bar-val"><strong>${item.val.toLocaleString()}</strong> (${pct}%)</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="height-bars-container">
        ${barsHtml}
      </div>
    `;
  }

  renderLocalityHotspotsChart(localities) {
    const container = document.getElementById('chart-locality-hotspots');
    if (!container) return;

    const topLocs = (localities || []).slice(0, 6);
    if (topLocs.length === 0) {
      container.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 20px;">No locality data available</div>';
      return;
    }

    const maxTotal = Math.max(...topLocs.map(l => l.total)) || 1;

    let rowsHtml = topLocs.map(l => {
      const totalPct = Math.round((l.total / maxTotal) * 100);
      const constrPct = Math.min(100, Math.round(((l.construction_sites || 0) / l.total) * 100));
      const anomPct = Math.min(100, Math.round(((l.anomalies || 0) / l.total) * 100));

      return `
        <div class="locality-hotspot-row">
          <div class="loc-hotspot-name">
            <strong>${l.locality}</strong>
            <span class="loc-total-badge">${l.total} bldgs</span>
          </div>
          <div class="loc-stacked-bar">
            <div class="bar-seg verified" style="width: ${Math.round((l.verified / l.total) * 100)}%;" title="Verified: ${l.verified}"></div>
            <div class="bar-seg construction" style="width: ${constrPct}%;" title="Under Construction: ${l.construction_sites || 0}"></div>
            <div class="bar-seg anomaly" style="width: ${anomPct}%;" title="Violations: ${l.anomalies}"></div>
          </div>
          <div class="loc-hotspot-tags">
            <span class="tag-constr">🏗️ ${l.construction_sites || 0} active</span>
            <span class="tag-anom">🚨 ${l.anomalies || 0} alerts</span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="locality-hotspots-wrap">
        <div class="hotspots-legend">
          <span><span class="legend-dot green"></span> Verified</span>
          <span><span class="legend-dot purple"></span> Under Construction</span>
          <span><span class="legend-dot red"></span> Statutory Notice</span>
        </div>
        ${rowsHtml}
      </div>
    `;
  }

  // --- CONSTRUCTION HOTSPOTS & VACANT LANDS ---

  renderConstructionHotspots(hotspots) {
    const container = document.getElementById('report-construction-cards');
    if (!container) return;

    if (!hotspots || hotspots.length === 0) {
      container.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 12px;">No active construction recorded in this district</div>';
      return;
    }

    container.innerHTML = hotspots.map(h => `
      <div class="construction-site-card">
        <div class="cs-header">
          <div class="cs-badge">🏗️ ACTIVE CONSTRUCTION</div>
          <div class="cs-permit">${h.permit_no}</div>
        </div>
        <h4 class="cs-title">${h.site_name}</h4>
        <div class="cs-meta">
          <div>📍 Locality: <strong>${h.locality}</strong></div>
          <div>👤 Sanctioned Owner: <strong>${h.owner}</strong></div>
          <div>📐 Planned Area: <strong>${h.area_sqyd} sq.yd</strong></div>
        </div>
        <div class="cs-stage">
          <span class="stage-label">Current Stage:</span>
          <strong class="stage-name">${h.stage}</strong>
        </div>
        <div class="cs-telemetry">
          <span class="drone-ico">🛸</span>
          <span>${h.drone_telemetry}</span>
        </div>
      </div>
    `).join('');
  }

  renderLeftSitesCatalog(leftSites) {
    const container = document.getElementById('report-leftsites-cards');
    if (!container) return;

    if (!leftSites || leftSites.length === 0) {
      container.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 12px;">No vacant sites recorded</div>';
      return;
    }

    container.innerHTML = leftSites.map(s => `
      <div class="left-site-card">
        <div class="ls-header">
          <strong class="ls-khasra">${s.khasra_no}</strong>
          <span class="ls-zoning-badge">${s.zoning}</span>
        </div>
        <div class="ls-meta">
          <div>📍 Locality: <strong>${s.locality}</strong></div>
          <div>📐 Plot Area: <strong>${s.area_sqyd} sq.yd</strong></div>
        </div>
        <div class="ls-revenue">${s.revenue_status}</div>
        <div class="ls-telemetry">
          <span>🛸 Telemetry:</span> ${s.telemetry}
        </div>
      </div>
    `).join('');
  }

  renderDisusedLandsCatalog(disused) {
    const container = document.getElementById('report-disused-cards');
    if (!container) return;

    if (!disused || disused.length === 0) {
      container.innerHTML = '<div style="color: #64748b; font-size: 0.8rem; padding: 12px;">No dormant / disused lands recorded</div>';
      return;
    }

    container.innerHTML = disused.map(d => `
      <div class="disused-card">
        <div class="ls-header">
          <strong class="ls-khasra" style="color: #475569;">${d.khasra_no}</strong>
          <span class="disused-badge">📦 NOT IN USE</span>
        </div>
        <div class="ls-meta">
          <div>📍 Locality: <strong>${d.locality}</strong></div>
          <div>📐 Cadastre Area: <strong>${d.area_sqyd} sq.yd</strong></div>
        </div>
        <div class="disused-condition"><strong>Audit Condition:</strong> ${d.condition}</div>
        <div class="disused-meters">
          <div>${d.power_status}</div>
          <div>${d.water_status}</div>
        </div>
      </div>
    `).join('');
  }

  // --- MASTER BUILDING REGISTER TABLE ---

  renderBuildingTable(buildings) {
    this.allTableBuildings = buildings || [];
    this.applyTableFilter();
  }

  applyTableFilter() {
    const tbody = document.getElementById('report-table-tbody');
    const countEl = document.getElementById('report-table-count');
    if (!tbody) return;

    let filtered = this.allTableBuildings || [];

    // Apply Chip Filter
    if (this.tableFilterChip === 'construction') {
      filtered = filtered.filter(b => b.land_use === 'Under Construction');
    } else if (this.tableFilterChip === 'leftsites') {
      filtered = filtered.filter(b => b.land_use === 'Left Site / Vacant');
    } else if (this.tableFilterChip === 'disused') {
      filtered = filtered.filter(b => b.land_use === 'Disused / Not in Use');
    } else if (this.tableFilterChip === 'violations') {
      filtered = filtered.filter(b => b.has_anomaly || b.audit_status.includes('Notice') || b.audit_status.includes('Illegal'));
    } else if (this.tableFilterChip === 'verified') {
      filtered = filtered.filter(b => b.audit_status === 'Verified');
    }

    // Apply Search Input
    if (this.tableSearchQuery) {
      const q = this.tableSearchQuery;
      filtered = filtered.filter(b =>
        (b.ulpin || '').toLowerCase().includes(q) ||
        (b.owner || '').toLowerCase().includes(q) ||
        (b.survey_no || '').toLowerCase().includes(q) ||
        (b.locality || '').toLowerCase().includes(q) ||
        (b.land_use || '').toLowerCase().includes(q) ||
        (b.audit_status || '').toLowerCase().includes(q)
      );
    }

    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${this.allTableBuildings.length} parcels`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 24px; color: #64748b;">
            No buildings matched the current search or filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.slice(0, 100).map(b => {
      let statusBadge = '<span class="rep-badge verified">✅ Verified</span>';
      if (b.audit_status === 'Illegal Activity') {
        statusBadge = '<span class="rep-badge illegal">⚖️ Illegal Activity</span>';
      } else if (b.audit_status === '24h Notice') {
        statusBadge = '<span class="rep-badge anomaly">🚨 24h Notice</span>';
      } else if (b.audit_status === 'Pending Scan') {
        statusBadge = '<span class="rep-badge pending">⏳ Pending Scan</span>';
      }

      let useBadge = '<span class="use-badge active">Active Use</span>';
      if (b.land_use === 'Under Construction') {
        useBadge = '<span class="use-badge constr">🏗️ Construction</span>';
      } else if (b.land_use === 'Left Site / Vacant') {
        useBadge = '<span class="use-badge vacant">🌾 Left Site</span>';
      } else if (b.land_use === 'Disused / Not in Use') {
        useBadge = '<span class="use-badge disused">📦 Disused</span>';
      }

      const discrepancy = (b.floors_detected !== b.floors_declared)
        ? `<span style="color: #dc2626; font-weight: 700;">${b.floors_detected} (Decl: ${b.floors_declared})</span>`
        : `<span>${b.floors_detected} Levels</span>`;

      return `
        <tr>
          <td class="ulpin-cell"><strong>${b.ulpin}</strong></td>
          <td>${b.survey_no}</td>
          <td><strong>${b.owner}</strong></td>
          <td>${b.locality}</td>
          <td>${discrepancy}</td>
          <td>${useBadge}</td>
          <td>${statusBadge}</td>
          <td>${b.area_sqyd} sq.yd</td>
          <td>₹${b.tax_amount?.toLocaleString() || '12,000'}</td>
          <td>
            <button class="btn-rep-view" onclick="window.app && window.app.locateOnMap('${b.ulpin}')" title="Locate on 3D Map">🗺️</button>
            <button class="btn-rep-view" onclick="window.app && window.app.inspectParcel('${b.ulpin}')" title="Inspect 3D Twin">🏢</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- DOWNLOAD & EXPORT ACTIONS ---

  downloadReportPDF() {
    // Uses official browser print layout with full multi-page PDF fidelity
    const prevTitle = document.title;
    const district = document.getElementById('report-district-select')?.value || 'District';
    document.title = `BHAVANINFO_Official_Cadastre_Report_${district}_2026`;

    // Unlock full multi-page flow by removing single-page viewport constraints
    document.documentElement.classList.add('is-printing-report');
    document.body.classList.add('is-printing-report');

    const cleanup = () => {
      document.documentElement.classList.remove('is-printing-report');
      document.body.classList.remove('is-printing-report');
      document.title = prevTitle;
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // Allow browser 60ms to reflow unconstrained multi-page height before opening print dialog
    setTimeout(() => {
      window.print();
      // Fallback cleanup in case afterprint does not fire in some browser versions
      setTimeout(cleanup, 2500);
    }, 60);
  }

  exportReportCSV() {
    if (!this.allTableBuildings || this.allTableBuildings.length === 0) {
      alert('No building records to export.');
      return;
    }

    const district = document.getElementById('report-district-select')?.value || 'District';
    const headers = ['ULPIN', 'Survey_No', 'Owner', 'Locality', 'Floors_Detected', 'Floors_Declared', 'Land_Utilization', 'Audit_Status', 'Area_SqYd', 'Property_Tax_INR', 'Drone_Scan_Date'];

    const rows = this.allTableBuildings.map(b => [
      `"${b.ulpin}"`,
      `"${b.survey_no}"`,
      `"${b.owner}"`,
      `"${b.locality}"`,
      b.floors_detected,
      b.floors_declared,
      `"${b.land_use}"`,
      `"${b.audit_status}"`,
      b.area_sqyd,
      b.tax_amount,
      `"${b.drone_scan_date}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cadastre_Report_${district}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
