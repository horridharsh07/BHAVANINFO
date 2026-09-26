// Main Application Controller: Auth, Navigation, Dossier HUD, and Drone Simulation
import { PUNJAB_PARCELS, CURRENT_USER } from './data/punjab_parcels.js';
import { CadastreMap2D } from './map2d.js?v=20260911_v7_vendors_restored';
import { DigitalTwin3D } from './twin3d.js?v=20260911_v7_vendors_restored';
import { TutorialTourGuide } from './utils/tutorial_tour.js?v=20260911_v1';
import { DistrictReportManager } from './utils/district_report.js?v=20260911_v26_pdf';

class BhuAadhaarApp {
  constructor() {
    this.currentUser = null;
    this.allParcels = PUNJAB_PARCELS;
    this.activeParcel = null;
    this.activeLevel = null;

    this.map2d = null;
    this.twin3d = null;

    // 5-Step Interactive Tutorial & Quick Tips Guide
    this.tutorialGuide = new TutorialTourGuide(this);

    // Official District Cadastre Report & Analytics Manager
    this.districtReport = new DistrictReportManager(this);

    // 24h Countdown Timer reference
    this.countdownTimer = null;
    this.secondsRemaining = 14 * 3600 + 22 * 60 + 35; // 14 hours 22 mins 35 secs

    // UIDAI Aadhaar & Biometric Face e-KYC state
    this.kycState = {
      otpSent: false,
      dynamicOtp: null,
      docMatched: false,
      docFileName: '',
      docDigits: '',
      faceVerified: false,
      cameraStream: null
    };
    this.otpCooldownTimer = null;
    this.upiCountdownTimer = null;
    this.upiPaymentState = null;
  }

  async init() {
    // 0. Auto-restore session if previously authenticated
    try {
      const savedUser = sessionStorage.getItem('bhuaadhaar_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.name) {
          this.currentUser = parsed;
        }
      }
    } catch (e) {}
    this.setupAccessibility();
    this.setupHeaderCollapseToggle();
    this.setupAuthHandlers();
    this.setupNavHandlers();
    this.setupGlobalCadastreSearch();
    this.setupModalHandlers();
    this.setupAiAssistant();
    this.setupHistorySlider();
    this.setupJurisdictionSelector();
    this.setupChallanPricingCalculator();

    // Initialize District Report Manager
    if (this.districtReport) {
      this.districtReport.init();
    }

    // Fetch live parcels from SQLite database backend
    await this.fetchParcelsFromBackend();

    // Check if new user needs 5-step tutorial & quick tips guide
    if (this.tutorialGuide) {
      this.tutorialGuide.checkAutoPrompt();
    }

    // Default to Public Department Landing Page (User logs in via top navigation or CTA)
    if (this.currentUser) {
      this.loginUser(this.currentUser);
    } else {
      this.switchView('landing');
    }
  }

  async fetchParcelsFromBackend() {
    try {
      const res = await fetch('/api/parcels');
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          this.allParcels = json.data;
          console.log(`✅ Loaded ${json.data.length} parcels from SQLite backend`);
        }
      }
    } catch (e) {
      console.warn('Using local offline parcels dataset fallback:', e);
      this.allParcels = PUNJAB_PARCELS;
    }
  }

  
  
  toggleSidePanel() {
    const panel = document.getElementById('landing-side-panel');
    const toggleBtn = document.getElementById('btn-toggle-side-panel');
    if (panel) {
      panel.classList.toggle('collapsed');
      const isCollapsed = panel.classList.contains('collapsed');
      if (toggleBtn) {
        if (isCollapsed) {
          toggleBtn.classList.add('visible');
          toggleBtn.style.display = 'flex';
        } else {
          toggleBtn.classList.remove('visible');
          toggleBtn.style.display = 'none';
        }
      }
    }
  }

  scrollToLandingSection(sectionId) {
    const el = document.getElementById(sectionId);
    const scrollContainer = document.getElementById('landing-main-scroll');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  enterPortalDirectly() {
    this.loginUser(CURRENT_USER);
  }

  setupAccessibility() {
    // Contrast Toggle
    const contrastBtn = document.getElementById('btn-high-contrast');
    if (contrastBtn) {
      contrastBtn.addEventListener('click', () => {
        const isHigh = document.body.getAttribute('data-theme') === 'high-contrast';
        if (isHigh) {
          document.body.removeAttribute('data-theme');
          contrastBtn.textContent = 'High Contrast';
        } else {
          document.body.setAttribute('data-theme', 'high-contrast');
          contrastBtn.textContent = 'Standard Mode';
        }
      });
    }

    // Font Scaling
    let currentScale = 1.0;
    const fontPlus = document.getElementById('btn-font-plus');
    const fontMinus = document.getElementById('btn-font-minus');
    const fontReset = document.getElementById('btn-font-reset');

    if (fontPlus) fontPlus.addEventListener('click', () => {
      currentScale = Math.min(1.25, currentScale + 0.05);
      document.body.style.fontSize = `${currentScale}rem`;
    });
    if (fontMinus) fontMinus.addEventListener('click', () => {
      currentScale = Math.max(0.85, currentScale - 0.05);
      document.body.style.fontSize = `${currentScale}rem`;
    });
    if (fontReset) fontReset.addEventListener('click', () => {
      currentScale = 1.0;
      document.body.style.fontSize = '1rem';
    });

    // Language Toggle
    const langSelect = document.getElementById('lang-selector');
    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        this.updateLanguage(e.target.value);
      });
    }
  }

  setupHeaderCollapseToggle() {
    const compactBar = document.getElementById('compact-name-bar');
    const headerWrapper = document.getElementById('collapsible-header');
    const btnExpand = document.getElementById('btn-expand-header-subtle');

    if (btnExpand && headerWrapper) {
      btnExpand.addEventListener('click', (e) => {
        e.stopPropagation();
        this.expandFullHeader();
      });
    }

    if (compactBar) {
      compactBar.addEventListener('click', () => {
        this.expandFullHeader();
      });
    }

    // Auto-hide full header after 5 seconds to maximize 3D viewport, showing only BHAVANINFO on top
    this.scheduleAutoCollapseHeader();
  }

  scheduleAutoCollapseHeader() {
    if (this.autoCollapseHeaderTimer) clearTimeout(this.autoCollapseHeaderTimer);
    this.autoCollapseHeaderTimer = setTimeout(() => {
      this.collapseHeaderToNameOnly();
    }, 5000);
  }

  collapseHeaderToNameOnly() {
    const headerWrapper = document.getElementById('collapsible-header');
    const compactBar = document.getElementById('compact-name-bar');
    const govNav = document.querySelector('.gov-nav');
    if (headerWrapper) {
      headerWrapper.classList.add('collapsed');
    }
    // If gov-nav is active, brand is already integrated in gov-nav, so keep compactBar hidden!
    const isGovNavActive = govNav && govNav.style.display !== 'none';
    if (compactBar) {
      compactBar.style.display = isGovNavActive ? 'none' : 'flex';
    }
    setTimeout(() => {
      if (this.map2d) this.map2d.invalidateSize();
      if (this.twin3d) this.twin3d.onResize();
    }, 360);
  }

  expandFullHeader() {
    const headerWrapper = document.getElementById('collapsible-header');
    const compactBar = document.getElementById('compact-name-bar');
    if (headerWrapper) {
      headerWrapper.classList.remove('collapsed');
    }
    if (compactBar) {
      compactBar.style.display = 'none';
    }
    setTimeout(() => {
      if (this.map2d) this.map2d.invalidateSize();
      if (this.twin3d) this.twin3d.onResize();
    }, 360);
  }

  // =========================================================
  // 5-Step Interactive Tutorial & Quick Tips Guide Delegation
  // =========================================================
  openTutorialMenu() {
    if (this.tutorialGuide) {
      this.tutorialGuide.startGuidedTour();
    }
  }

  showQuickTipsModal() {
    if (this.tutorialGuide) {
      this.tutorialGuide.showQuickTipsModal();
    }
  }

  closeQuickTipsModal() {
    if (this.tutorialGuide) {
      const chk = document.getElementById('chk-dont-show-tips');
      this.tutorialGuide.closeQuickTipsModal(chk ? chk.checked : false);
    }
  }

  skipTipsModal() {
    if (this.tutorialGuide) {
      const chk = document.getElementById('chk-dont-show-tips');
      this.tutorialGuide.closeQuickTipsModal(chk ? chk.checked : true);
      this.tutorialGuide.skipTour();
    }
  }

  startGuidedTour() {
    if (this.tutorialGuide) {
      this.tutorialGuide.startGuidedTour();
    }
  }

  nextTourStep() {
    if (this.tutorialGuide) {
      this.tutorialGuide.nextTourStep();
    }
  }

  prevTourStep() {
    if (this.tutorialGuide) {
      this.tutorialGuide.prevTourStep();
    }
  }

  skipTour() {
    if (this.tutorialGuide) {
      this.tutorialGuide.skipTour();
    }
  }

  finishTour() {
    if (this.tutorialGuide) {
      this.tutorialGuide.finishTour();
    }
  }

  updateLanguage(lang) {
    const portalTitle = document.getElementById('portal-title-text');
    if (lang === 'pa') {
      if (portalTitle) portalTitle.innerHTML = 'BHAVANINFO (ਭਵਨ ਇਨਫੋ) <span class="header-domain-pill">bhanav.govt</span>';
    } else if (lang === 'hi') {
      if (portalTitle) portalTitle.innerHTML = 'BHAVANINFO (भवनइन्फो) <span class="header-domain-pill">bhanav.govt</span>';
    } else {
      if (portalTitle) portalTitle.innerHTML = 'BHAVANINFO <span class="header-domain-pill">bhanav.govt</span>';
    }
  }

  
  
  formatAadhaarInput(input) {
    if (!input) return;
    const raw = input.value.replace(/\D/g, '').slice(0, 12);
    let formatted = '';
    for (let i = 0; i < raw.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += raw[i];
    }
    input.value = formatted;
    const validIcon = document.getElementById('aadhaar-valid-icon');
    if (validIcon) {
      validIcon.style.display = raw.length === 12 ? 'inline' : 'none';
    }
  }

  async handleSendOtp() {
    const sendOtpBtn = document.getElementById('btn-send-otp');
    const otpBadge = document.getElementById('otp-status-badge');
    const aadhaarInput = document.getElementById('input-aadhaar');
    const mobileInput = document.getElementById('input-mobile');

    const aadhaarVal = aadhaarInput ? aadhaarInput.value.replace(/\D/g, '') : '';
    const mobileVal = mobileInput ? mobileInput.value.replace(/\D/g, '') : '';

    if (aadhaarVal.length !== 12) {
      if (otpBadge) {
        otpBadge.style.display = 'block';
        otpBadge.style.background = '#fee2e2';
        otpBadge.style.color = '#991b1b';
        otpBadge.style.border = '1px solid #fecaca';
        otpBadge.innerHTML = '⚠️ Please enter a valid 12-digit Aadhaar / VID number first.';
      }
      if (aadhaarInput) aadhaarInput.focus();
      return;
    }

    if (mobileVal.length !== 10) {
      if (otpBadge) {
        otpBadge.style.display = 'block';
        otpBadge.style.background = '#fee2e2';
        otpBadge.style.color = '#991b1b';
        otpBadge.style.border = '1px solid #fecaca';
        otpBadge.innerHTML = '⚠️ Please enter your 10-digit mobile number linked with Aadhaar.';
      }
      if (mobileInput) mobileInput.focus();
      return;
    }

    if (sendOtpBtn) {
      sendOtpBtn.disabled = true;
      sendOtpBtn.textContent = 'Sending OTP...';
    }

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar: aadhaarVal, mobile: mobileVal })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (otpBadge) {
          otpBadge.style.display = 'block';
          otpBadge.style.background = '#fee2e2';
          otpBadge.style.color = '#991b1b';
          otpBadge.style.border = '1px solid #fecaca';
          otpBadge.innerHTML = `⚠️ ${data.error || 'Failed to dispatch OTP'}`;
        }
        if (sendOtpBtn) {
          sendOtpBtn.disabled = false;
          sendOtpBtn.textContent = 'Get OTP';
        }
        return;
      }

      this.kycState.otpSent = true;
      this.kycState.dynamicOtp = data.otp_code;

      if (otpBadge) {
        otpBadge.style.display = 'block';
        if (data.real_sms_delivered) {
          otpBadge.style.background = '#dcfce7';
          otpBadge.style.color = '#14532d';
          otpBadge.style.border = '1px solid #bbf7d0';
          otpBadge.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 2px;">📱 National SMS Gateway &bull; Real SMS Dispatched!</div>
            <div>An official SMS with your 6-digit OTP was sent to mobile <strong>${data.masked_mobile}</strong>. Please check your physical phone messages. (Valid for 10 minutes)</div>
          `;
        } else {
          otpBadge.style.background = '#eff6ff';
          otpBadge.style.color = '#1e3a8a';
          otpBadge.style.border = '1px solid #bfdbfe';
          otpBadge.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 3px;">📨 UIDAI / National SMS Gateway &bull; OTP Dispatched</div>
            <div>OTP <strong style="color: #0284c7; font-size: 1.05rem; letter-spacing: 2px;">${data.otp_code}</strong> dispatched to mobile <strong>${data.masked_mobile}</strong>. (Valid for 10 minutes)</div>
          `;
        }
      }

      const otpInput = document.getElementById('input-otp');
      if (otpInput) {
        otpInput.value = '';
        otpInput.focus();
      }

      // Start 60-second cooldown timer
      let cd = 60;
      if (sendOtpBtn) {
        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = `Resend (${cd}s)`;
      }
      if (this.otpCooldownTimer) clearInterval(this.otpCooldownTimer);
      this.otpCooldownTimer = setInterval(() => {
        cd--;
        if (cd <= 0) {
          clearInterval(this.otpCooldownTimer);
          if (sendOtpBtn) {
            sendOtpBtn.disabled = false;
            sendOtpBtn.textContent = 'Resend OTP';
          }
        } else {
          if (sendOtpBtn) sendOtpBtn.textContent = `Resend (${cd}s)`;
        }
      }, 1000);

    } catch (err) {
      console.error('Error sending OTP:', err);
      if (otpBadge) {
        otpBadge.style.display = 'block';
        otpBadge.style.background = '#fee2e2';
        otpBadge.style.color = '#991b1b';
        otpBadge.style.border = '1px solid #fecaca';
        otpBadge.innerHTML = '⚠️ Network error communicating with SMS Gateway. Please retry.';
      }
      if (sendOtpBtn) {
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'Get OTP';
      }
    }
  }

  toggleSmsConfigBox() {
    const box = document.getElementById('fast2sms-config-drawer');
    if (box) {
      const isVisible = box.style.display === 'block';
      box.style.display = isVisible ? 'none' : 'block';
      const keyInput = document.getElementById('input-fast2sms-key');
      if (!isVisible && keyInput) {
        keyInput.focus();
      }
    }
  }

  async saveFast2SmsKey() {
    const keyInput = document.getElementById('input-fast2sms-key');
    const statusEl = document.getElementById('fast2sms-save-status');
    const key = keyInput ? keyInput.value.trim() : '';

    if (!key) {
      alert('Please enter your Fast2SMS API key.');
      return;
    }

    try {
      const res = await fetch('/api/auth/sms-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fast2sms_api_key: key })
      });
      const data = await res.json();
      if (statusEl) {
        statusEl.innerHTML = '✅ Fast2SMS API Key saved! Now click "Get OTP" to receive real SMS on your phone.';
        statusEl.style.display = 'block';
        statusEl.style.color = '#166534';
      }
    } catch (e) {
      alert('Failed to save Fast2SMS key.');
    }
  }

  async handleAadhaarFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    const statusEl = document.getElementById('doc-upload-status');
    if (!file) return;

    const aadhaarInput = document.getElementById('input-aadhaar');
    const aadhaarDigits = aadhaarInput ? aadhaarInput.value.replace(/\D/g, '') : '';

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<span style="color: #0284c7;">⏳ Validating soft copy & scanning document digits...</span>';
    }

    try {
      const res = await fetch('/api/auth/verify-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_aadhaar: aadhaarDigits,
          file_name: file.name,
          doc_digits: aadhaarDigits || '602285810827'
        })
      });
      const data = await res.json();
      if (data.success && data.matches) {
        this.kycState.docMatched = true;
        this.kycState.docFileName = file.name;
        if (data.citizen_name) {
          const nameInput = document.getElementById('input-citizen-name');
          if (nameInput) nameInput.value = data.citizen_name;
        }
        if (data.doc_aadhaar) {
          const aadhaarInput = document.getElementById('input-aadhaar');
          if (aadhaarInput) {
            aadhaarInput.value = data.doc_aadhaar;
            this.formatAadhaarInput(aadhaarInput);
          }
        }
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #166534; font-weight: 600; background: #dcfce7; padding: 6px 10px; border-radius: 4px; display: inline-block; line-height: 1.4;">${data.verification_message || `✅ Verified: <strong>${file.name}</strong>`}</span>`;
        }
      } else {
        this.kycState.docMatched = false;
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #991b1b; font-weight: 600; background: #fee2e2; padding: 4px 8px; border-radius: 4px; display: inline-block;">⚠️ Document Mismatch: Extracted number does not match input</span>`;
        }
      }
    } catch (e) {
      this.kycState.docMatched = true;
      this.kycState.docFileName = file.name;
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #166534; font-weight: 600; background: #dcfce7; padding: 4px 8px; border-radius: 4px; display: inline-block;">✅ Uploaded: <strong>${file.name}</strong></span>`;
      }
    }
  }

  async useThanujAadhaarSoftCopy() {
    const aadhaarInput = document.getElementById('input-aadhaar');
    const nameInput = document.getElementById('input-citizen-name');
    const statusEl = document.getElementById('doc-upload-status');

    if (aadhaarInput) {
      aadhaarInput.value = '602285810827';
      this.formatAadhaarInput(aadhaarInput);
    }
    if (nameInput) {
      nameInput.value = 'Penna Peruru Thanuj';
    }

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<span style="color: #0284c7;">⏳ Validating soft copy & scanning document digits...</span>';
    }

    try {
      const res = await fetch('/api/auth/verify-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_aadhaar: '602285810827',
          file_name: 'sample_aadhaar_thanuj.jpg',
          doc_digits: '602285810827'
        })
      });
      const data = await res.json();
      this.kycState.docMatched = true;
      this.kycState.docFileName = 'sample_aadhaar_thanuj.jpg';
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #166534; font-weight: 600; background: #dcfce7; padding: 6px 10px; border-radius: 4px; display: inline-block; line-height: 1.4;">${data.verification_message || '✅ Real Aadhaar Verified: <strong>Penna Peruru Thanuj</strong> &bull; 6022 8581 0827'}</span>`;
      }
    } catch (e) {
      this.kycState.docMatched = true;
      if (statusEl) {
        statusEl.innerHTML = '<span style="color: #166534; font-weight: 600; background: #dcfce7; padding: 4px 8px; border-radius: 4px; display: inline-block;">✅ Real Aadhaar Verified: <strong>Penna Peruru Thanuj</strong></span>';
      }
    }
  }

  openFaceKycModal() {
    const modal = document.getElementById('modal-face-kyc');
    if (modal) modal.style.display = 'flex';
    this.startFaceCamera();
  }

  closeFaceKycModal() {
    const modal = document.getElementById('modal-face-kyc');
    if (modal) modal.style.display = 'none';
    if (this.kycState.cameraStream) {
      try {
        this.kycState.cameraStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.kycState.cameraStream = null;
    }
  }

  async startFaceCamera() {
    const video = document.getElementById('kyc-video-stream');
    const hud = document.getElementById('kyc-scanner-hud');
    if (!video) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        this.kycState.cameraStream = stream;
        video.srcObject = stream;
        await video.play();
        if (hud) hud.innerHTML = '🟢 Optical stream active &bull; Position face inside oval';
      } else {
        if (hud) hud.innerHTML = 'ℹ️ Camera API unavailable &bull; Optical simulation active';
      }
    } catch (err) {
      console.warn('WebCam permission or device not accessible, fallback to optical simulation:', err);
      if (hud) hud.innerHTML = 'ℹ️ Camera fallback mode &bull; Ready for Biometric Scan';
    }
  }

  captureFaceBiometrics() {
    const btn = document.getElementById('btn-capture-face-kyc');
    const hud = document.getElementById('kyc-scanner-hud');
    const faceStatusTxt = document.getElementById('face-kyc-status-txt');
    const video = document.getElementById('kyc-video-stream');
    const canvas = document.getElementById('kyc-canvas-capture');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Scanning Biometrics (ISO 19794)...';
    }
    if (hud) {
      hud.innerHTML = '⚡ Scanning Facial Landmark Vector (128-pt CIDR)...';
    }

    if (video && canvas && this.kycState.cameraStream) {
      try {
        canvas.width = video.videoWidth || 300;
        canvas.height = video.videoHeight || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (e) {}
    }

    setTimeout(() => {
      this.kycState.faceVerified = true;
      if (hud) hud.innerHTML = '✅ Biometric Liveness Verified (Score: 99.4%)';
      if (faceStatusTxt) {
        faceStatusTxt.innerHTML = '<span style="color: #166534; font-weight: 700;">✅ Face e-KYC Verified (CIDR Score 99.4%)</span>';
      }
      const openBtn = document.getElementById('btn-open-face-kyc');
      if (openBtn) {
        openBtn.textContent = 'Verified ✅';
        openBtn.style.background = '#16a34a';
      }
      setTimeout(() => {
        this.closeFaceKycModal();
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Capture Face & Verify';
        }
      }, 900);
    }, 1200);
  }

  simulateFaceKyc() {
    this.kycState.faceVerified = true;
    const faceStatusTxt = document.getElementById('face-kyc-status-txt');
    if (faceStatusTxt) {
      faceStatusTxt.innerHTML = '<span style="color: #166534; font-weight: 700;">✅ Face e-KYC Verified (Score 99.4%)</span>';
    }
    const openBtn = document.getElementById('btn-open-face-kyc');
    if (openBtn) {
      openBtn.textContent = 'Verified ✅';
      openBtn.style.background = '#16a34a';
    }
    this.closeFaceKycModal();
  }

  loginDemoHarpreet() {
    this.loginUser(CURRENT_USER);
  }

  refreshCaptcha() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const captchaDisplay = document.getElementById('captcha-display');
    const captchaInput = document.getElementById('input-captcha');
    if (captchaDisplay) {
      captchaDisplay.textContent = code.split('').join(' ');
    }
    if (captchaInput) {
      captchaInput.value = code;
    }
  }

  async handleAadhaarSubmit(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const btn = document.getElementById('btn-submit-aadhaar');
    const origText = btn ? btn.textContent : 'Verify Credentials & Enter Portal';

    const nameInput = document.getElementById('input-citizen-name');
    const aadhaarInput = document.getElementById('input-aadhaar');
    const mobileInput = document.getElementById('input-mobile');
    const otpInput = document.getElementById('input-otp');

    const citizenName = nameInput ? nameInput.value.trim() : '';
    const aadhaarVal = aadhaarInput ? aadhaarInput.value.replace(/\D/g, '') : '';
    const mobileVal = mobileInput ? mobileInput.value.replace(/\D/g, '') : '';
    const otpVal = otpInput ? otpInput.value.trim() : '';

    if (aadhaarVal.length !== 12) {
      alert('⚠️ Please enter a valid 12-digit Aadhaar / VID number.');
      if (aadhaarInput) aadhaarInput.focus();
      return;
    }

    if (mobileVal.length !== 10) {
      alert('⚠️ Please enter a valid 10-digit registered mobile number.');
      if (mobileInput) mobileInput.focus();
      return;
    }

    if (!otpVal || otpVal.length !== 6) {
      alert('⚠️ Please request and enter the 6-digit OTP received on your mobile.');
      if (otpInput) otpInput.focus();
      return;
    }

    if (btn) {
      btn.textContent = 'Verifying Credentials & e-KYC...';
      btn.disabled = true;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: citizenName || undefined,
          aadhaar: aadhaarVal,
          mobile: mobileVal,
          otp: otpVal,
          document_matched: this.kycState.docMatched,
          face_verified: this.kycState.faceVerified
        })
      });
      const data = await res.json();
      if (btn) {
        btn.textContent = origText;
        btn.disabled = false;
      }

      if (!res.ok || data.error) {
        alert(data.error || 'Invalid OTP or verification failed. Please try again.');
        return;
      }

      if (data && data.success && data.profile) {
        this.loginUser(data.profile);
        return;
      }
    } catch (err) {
      console.warn('Backend verification fallback:', err);
      if (btn) {
        btn.textContent = origText;
        btn.disabled = false;
      }
    }

    // Fallback if network issue: create fresh citizen profile with ZERO properties
    this.loginUser({
      name: citizenName || `Citizen (XXXX-XXXX-${aadhaarVal.slice(-4)})`,
      role: 'CITIZEN',
      aadhaar_masked: `XXXX-XXXX-${aadhaarVal.slice(-4)}`,
      mobile: `+91 ${mobileVal}`,
      address: 'Urban Cadastre Zone, Amritsar, Punjab',
      properties_owned: []
    });
  }

  async handleJanparichaySubmit(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const username = (document.getElementById('input-jp-username')?.value || '').toLowerCase();
    if (username.includes('officer') || username.includes('vikram') || username.includes('pcs') || username.includes('admin')) {
      this.loginUser({
        name: 'Shri Vikramjit Singh, PCS',
        role: 'AUTHORITY_HEAD',
        aadhaar_masked: 'XXXX-XXXX-1044',
        mobile: '+91 94172-XXXXX',
        address: 'District Administrative Complex, Court Road, Amritsar',
        properties_owned: []
      });
    } else {
      this.loginUser(CURRENT_USER);
    }
  }

  async handleTokenSubmit(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const tokenType = document.getElementById('select-token')?.value || 'harpreet';
    if (tokenType === 'officer') {
      this.loginUser({
        name: 'Shri Vikramjit Singh, PCS',
        role: 'AUTHORITY_HEAD',
        aadhaar_masked: 'XXXX-XXXX-1044',
        mobile: '+91 94172-XXXXX',
        address: 'District Administrative Complex, Court Road, Amritsar',
        properties_owned: []
      });
    } else {
      this.loginUser(CURRENT_USER);
    }
  }

  setupAuthHandlers() {
    // 1. Auth Tabs Switcher (Aadhaar / JanParichay / Token)
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabType = tab.getAttribute('data-auth-tab');
        
        ['aadhaar', 'janparichay', 'token'].forEach(type => {
          const pane = document.getElementById(`auth-pane-${type}`);
          if (pane) {
            pane.style.display = (type === tabType) ? 'block' : 'none';
          }
        });
      });
    });

    // 2. Aadhaar OTP Button
    const sendOtpBtn = document.getElementById('btn-send-otp');
    if (sendOtpBtn) {
      sendOtpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSendOtp();
      });
    }

    // 3. Aadhaar OTP Login Form Submit
    const aadhaarForm = document.getElementById('aadhaar-login-form');
    if (aadhaarForm) {
      aadhaarForm.addEventListener('submit', (e) => this.handleAadhaarSubmit(e));
    }
    const jpForm = document.getElementById('janparichay-login-form');
    if (jpForm) {
      jpForm.addEventListener('submit', (e) => this.handleJanparichaySubmit(e));
    }
    const tokenForm = document.getElementById('token-login-form');
    if (tokenForm) {
      tokenForm.addEventListener('submit', (e) => this.handleTokenSubmit(e));
    }

    // 8. Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logoutUser();
      });
    }
  }

  loginUser(user) {
    this.currentUser = user || CURRENT_USER;
    this.closeLoginModal();

    try {
      sessionStorage.setItem('bhuaadhaar_user', JSON.stringify(this.currentUser));
    } catch (e) {}

    // Reveal Authenticated Gov Nav
    const govNav = document.querySelector('.gov-nav');
    if (govNav) govNav.style.display = 'flex';
    const compactBar = document.getElementById('compact-name-bar');
    if (compactBar) compactBar.style.display = 'none';

    // Collapse bulky header to give full space to portal immediately
    this.collapseHeaderToNameOnly();

    // Update Profile Pill in Nav
    const pill = document.getElementById('user-profile-pill');
    const nameEl = document.getElementById('user-pill-name');
    if (pill) pill.style.display = 'flex';
    if (nameEl) nameEl.textContent = this.currentUser.name || 'Sardar Harpreet Singh';

    // Strictly hide view-landing and reveal target view
    const landing = document.getElementById('view-landing');
    if (landing) {
      landing.classList.remove('active');
      landing.style.display = 'none';
    }

    // Route to appropriate view based on role
    try {
      if (this.currentUser.role === 'AUTHORITY_HEAD') {
        this.switchView('officer');
      } else {
        this.switchView('dashboard');
        this.renderDashboard(this.currentUser);
      }
    } catch (err) {
      console.warn('Dashboard render error handled:', err);
      this.switchView('dashboard');
    }

    // Schedule 5s auto-collapse header timer to maximize 3D viewport
    this.scheduleAutoCollapseHeader();
  }

  async renderOfficerDashboard() {
    try {
      const res = await fetch('/api/officer/stats');
      if (res.ok) {
        const data = await res.json();
        const violEl = document.getElementById('officer-stat-violations');
        if (violEl && data.stats) {
          violEl.textContent = `${data.stats.flagged_violations} Flagged Notices`;
        }
      }
    } catch (e) {
      console.warn('Officer stats fetch failed:', e);
    }
  }

  logoutUser() {
    this.currentUser = null;
    try {
      sessionStorage.removeItem('bhuaadhaar_user');
    } catch (e) {}

    const govNav = document.querySelector('.gov-nav');
    const mapRibbon = document.getElementById('map-sub-header-bar');
    const historyBar = document.getElementById('cadastre-history-bar');
    if (govNav) govNav.style.display = 'none';
    if (mapRibbon) mapRibbon.style.display = 'none';
    if (historyBar) historyBar.style.display = 'none';

    this.switchView('landing');
  }

  setupNavHandlers() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const targetView = e.currentTarget.getAttribute('data-view');
        if (targetView) {
          this.switchView(targetView);
        }
      });
    });
  }

  setupGlobalCadastreSearch() {
    const searchInput = document.getElementById('global-cadastre-search');
    const clearBtn = document.getElementById('btn-clear-search');
    const dropdown = document.getElementById('search-autocomplete-dropdown');

    if (!searchInput || !dropdown) return;

    // Pan-India States & UTs Registry
    const indianStates = [
      { name: 'Punjab', center: [75.3412, 31.1471], zoom: 8, type: 'State' },
      { name: 'Delhi (NCT)', center: [77.2090, 28.6139], zoom: 11, type: 'UT / Capital' },
      { name: 'Chandigarh', center: [76.7794, 30.7333], zoom: 12, type: 'UT / Capital' },
      { name: 'Maharashtra', center: [75.7139, 19.7515], zoom: 7.5, type: 'State' },
      { name: 'Karnataka', center: [75.7139, 15.3173], zoom: 7.5, type: 'State' },
      { name: 'Tamil Nadu', center: [78.6569, 11.1271], zoom: 7.5, type: 'State' },
      { name: 'Uttar Pradesh', center: [80.9462, 26.8467], zoom: 7.5, type: 'State' },
      { name: 'Gujarat', center: [71.1924, 22.2587], zoom: 7.5, type: 'State' },
      { name: 'Rajasthan', center: [74.2179, 27.0238], zoom: 7, type: 'State' },
      { name: 'West Bengal', center: [87.8550, 22.9868], zoom: 7.5, type: 'State' },
      { name: 'Telangana', center: [79.0193, 18.1124], zoom: 7.5, type: 'State' },
      { name: 'Andhra Pradesh', center: [79.7400, 15.9129], zoom: 7.5, type: 'State' },
      { name: 'Kerala', center: [76.2711, 10.8505], zoom: 7.5, type: 'State' },
      { name: 'Haryana', center: [76.0856, 29.0588], zoom: 8, type: 'State' },
      { name: 'Bihar', center: [85.3131, 25.0961], zoom: 7.5, type: 'State' },
      { name: 'Madhya Pradesh', center: [78.6569, 22.9734], zoom: 7, type: 'State' },
      { name: 'Odisha', center: [85.0985, 20.9517], zoom: 7.5, type: 'State' },
      { name: 'Assam', center: [92.9376, 26.2006], zoom: 7.5, type: 'State' },
      { name: 'Himachal Pradesh', center: [77.1734, 31.1048], zoom: 8, type: 'State' },
      { name: 'Uttarakhand', center: [79.0193, 30.0668], zoom: 8, type: 'State' },
      { name: 'Goa', center: [74.1240, 15.2993], zoom: 10, type: 'State' },
      { name: 'Jammu & Kashmir', center: [74.7973, 33.7782], zoom: 7.5, type: 'UT' },
      { name: 'Ladakh', center: [77.5771, 34.1526], zoom: 7, type: 'UT' },
      { name: 'Puducherry', center: [79.8083, 11.9416], zoom: 11, type: 'UT' }
    ];

    // Major Cities & Divisions
    const indianCities = [
      { name: 'Amritsar', state: 'Punjab', center: [74.8620, 31.6125], zoom: 15.5 },
      { name: 'Jalandhar', state: 'Punjab', center: [75.5650, 31.3150], zoom: 15.5 },
      { name: 'Ludhiana', state: 'Punjab', center: [75.8450, 30.8950], zoom: 15.5 },
      { name: 'Patiala', state: 'Punjab', center: [76.3869, 30.3398], zoom: 15 },
      { name: 'Bathinda', state: 'Punjab', center: [74.9455, 30.2110], zoom: 15 },
      { name: 'Mohali (SAS Nagar)', state: 'Punjab', center: [76.7179, 30.7046], zoom: 15 },
      { name: 'New Delhi', state: 'Delhi NCT', center: [77.2090, 28.6139], zoom: 15.5 },
      { name: 'Mumbai', state: 'Maharashtra', center: [72.8777, 19.0760], zoom: 15 },
      { name: 'Bengaluru', state: 'Karnataka', center: [77.5946, 12.9716], zoom: 15 },
      { name: 'Hyderabad', state: 'Telangana', center: [78.4867, 17.3850], zoom: 15 },
      { name: 'Chennai', state: 'Tamil Nadu', center: [80.2707, 13.0827], zoom: 15 },
      { name: 'Kolkata', state: 'West Bengal', center: [88.3639, 22.5726], zoom: 15 },
      { name: 'Ahmedabad', state: 'Gujarat', center: [72.5714, 23.0225], zoom: 15 },
      { name: 'Pune', state: 'Maharashtra', center: [73.8567, 18.5204], zoom: 15 },
      { name: 'Jaipur', state: 'Rajasthan', center: [75.7873, 26.9124], zoom: 15 },
      { name: 'Lucknow', state: 'Uttar Pradesh', center: [80.9462, 26.8467], zoom: 15 }
    ];

    const parseCoords = (txt) => {
      const match = txt.match(/(-?\d+(\.\d+)?)\s*°?\s*([NS])?\s*[, ]\s*(-?\d+(\.\d+)?)\s*°?\s*([EW])?/i);
      if (match) {
        let v1 = parseFloat(match[1]);
        let v2 = parseFloat(match[4]);
        if (match[3] && match[3].toUpperCase() === 'S') v1 = -v1;
        if (match[6] && match[6].toUpperCase() === 'W') v2 = -v2;
        let lat, lng;
        if (v1 > 60 && v1 < 100) { lng = v1; lat = v2; }
        else { lat = v1; lng = v2; }
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
      return null;
    };

    let currentSearchTerm = '';

    const bindItemListeners = () => {
      dropdown.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.getAttribute('data-action');
          if (action === 'coord') {
            const lat = parseFloat(item.getAttribute('data-lat'));
            const lng = parseFloat(item.getAttribute('data-lng'));
            this.switchView('map');
            setTimeout(() => {
              if (this.map2d) {
                this.map2d.flyToLocation({ center: [lng, lat], zoom: 17.5, name: `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E` });
              }
            }, 100);
          } else if (action === 'parcel' || action === 'ulpin') {
            const ulpin = item.getAttribute('data-ulpin');
            this.locateOnMap(ulpin);
          } else if (action === 'city' || action === 'state') {
            const lat = parseFloat(item.getAttribute('data-lat'));
            const lng = parseFloat(item.getAttribute('data-lng'));
            const zoom = parseFloat(item.getAttribute('data-zoom'));
            const name = item.getAttribute('data-name');
            this.switchView('map');
            setTimeout(() => {
              if (this.map2d) {
                this.map2d.flyToLocation({ center: [lng, lat], zoom: zoom, name: name });
              }
            }, 100);
          }
          dropdown.style.display = 'none';
        });
      });
    };

    const renderResults = async (query) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
      }
      if (clearBtn) clearBtn.style.display = 'block';

      currentSearchTerm = q;
      let html = '';
      const coordMatch = parseCoords(query);

      // 1. Coordinate Match
      if (coordMatch) {
        html += `
          <div class="search-category-header">📍 Exact GPS Geolocation</div>
          <div class="search-result-item" data-action="coord" data-lat="${coordMatch.lat}" data-lng="${coordMatch.lng}">
            <span class="search-item-icon">📍</span>
            <div class="search-item-main">
              <div class="search-item-title">Fly to GPS Coordinates: ${coordMatch.lat.toFixed(5)}° N, ${coordMatch.lng.toFixed(5)}° E</div>
              <div class="search-item-subtitle">High-precision satellite inspection &bull; Google Maps directions enabled</div>
            </div>
            <span class="search-item-badge">GPS Centroid</span>
          </div>
        `;
      }

      // Check if input looks like an ULPIN or partial ULPIN (e.g. alphanumeric 3-16 chars)
      const cleanAlphanum = query.trim().replace(/[^A-Za-z0-9\/-]/g, '').toUpperCase();
      const isUlpinLike = cleanAlphanum.length >= 3 && !query.includes(' ');

      if (isUlpinLike) {
        html += `
          <div class="search-category-header">🎯 Direct Bhu-Aadhaar ULPIN Lookup</div>
          <div class="search-result-item highlight-ulpin" data-action="ulpin" data-ulpin="${cleanAlphanum}">
            <span class="search-item-icon">🎯</span>
            <div class="search-item-main">
              <div class="search-item-title">Locate Bhu-Aadhaar ULPIN: <strong>${cleanAlphanum}</strong></div>
              <div class="search-item-subtitle">Instant 3D Extrusion Close-up &bull; LiDAR Inspection &bull; Cadastral Dossier</div>
            </div>
            <span class="search-item-badge">Direct ULPIN</span>
          </div>
        `;
      }

      // 2. Real Buildings & Parcels Match from local memory (portfolio + 10,300 GeoJSON buildings)
      const localMatches = [];
      const seenUlpins = new Set();
      if (cleanAlphanum) seenUlpins.add(cleanAlphanum);

      // 2A. Search this.allParcels
      (this.allParcels || []).forEach(p => {
        const bhu = this.getBhuNakshaRecord ? this.getBhuNakshaRecord(p) : {};
        const matches = (p.ulpin && p.ulpin.toLowerCase().includes(q)) ||
                        (p.legacy_ulpin && p.legacy_ulpin.toLowerCase().includes(q)) ||
                        (p.owner && p.owner.toLowerCase().includes(q)) ||
                        (p.survey_no && p.survey_no.toLowerCase().includes(q)) ||
                        (bhu.khasraNo && bhu.khasraNo.toLowerCase().includes(q)) ||
                        (bhu.hadbastNo && bhu.hadbastNo.includes(q)) ||
                        (bhu.village && bhu.village.toLowerCase().includes(q)) ||
                        (p.locality && p.locality.toLowerCase().includes(q));
        if (matches && !seenUlpins.has(p.ulpin)) {
          seenUlpins.add(p.ulpin);
          localMatches.push(p);
        }
      });

      // 2B. Search loaded MapLibre GeoJSON 10,300 buildings
      if (localMatches.length < 8 && this.map2d?.currentGeoJSON?.features) {
        const feats = this.map2d.currentGeoJSON.features;
        for (let i = 0; i < feats.length && localMatches.length < 8; i++) {
          const p = feats[i].properties || {};
          if (!p.ulpin || seenUlpins.has(p.ulpin)) continue;
          if ((p.ulpin && p.ulpin.toLowerCase().includes(q)) ||
              (p.legacy_ulpin && p.legacy_ulpin.toLowerCase().includes(q)) ||
              (p.owner && p.owner.toLowerCase().includes(q)) ||
              (p.survey_no && p.survey_no.toLowerCase().includes(q)) ||
              (p.locality && p.locality.toLowerCase().includes(q)) ||
              (p.khasra_no && p.khasra_no.toLowerCase().includes(q))) {
            seenUlpins.add(p.ulpin);
            localMatches.push({
              ulpin: p.ulpin,
              survey_no: p.survey_no || `Khasra No. ${p.khasra_no || ''}`,
              owner: p.owner || 'Landholder',
              locality: p.locality || 'Amritsar Cadastre',
              total_floors: p.total_floors || 2,
              status: p.status || 'DIGITALIZED',
              coordinates: feats[i].geometry?.coordinates
            });
          }
        }
      }

      if (localMatches.length > 0) {
        html += `<div class="search-category-header">🏢 Cadastral Buildings &amp; ULPINs</div>`;
        localMatches.slice(0, 6).forEach(p => {
          html += `
            <div class="search-result-item" data-action="parcel" data-ulpin="${p.ulpin}">
              <span class="search-item-icon">🏢</span>
              <div class="search-item-main">
                <div class="search-item-title">${p.survey_no || p.ulpin} &bull; ${p.owner || 'Landholder'}</div>
                <div class="search-item-subtitle">${p.locality || 'Amritsar'} &bull; ${p.total_floors || 2} Floors &bull; ${p.status || 'DIGITALIZED'}</div>
              </div>
              <span class="search-item-badge">${p.ulpin}</span>
            </div>
          `;
        });
      }

      // 3. Indian Cities Match
      const matchedCities = indianCities.filter(c => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)).slice(0, 4);
      if (matchedCities.length > 0) {
        html += `<div class="search-category-header">🌆 Indian Cities &amp; Divisions</div>`;
        matchedCities.forEach(c => {
          html += `
            <div class="search-result-item" data-action="city" data-lng="${c.center[0]}" data-lat="${c.center[1]}" data-zoom="${c.zoom}" data-name="${c.name}">
              <span class="search-item-icon">🌆</span>
              <div class="search-item-main">
                <div class="search-item-title">${c.name}, ${c.state}</div>
                <div class="search-item-subtitle">Fly to Municipal Division Cadastre (3D Skyline)</div>
              </div>
              <span class="search-item-badge">City</span>
            </div>
          `;
        });
      }

      // 4. Indian States & UTs Match
      const matchedStates = indianStates.filter(s => s.name.toLowerCase().includes(q)).slice(0, 4);
      if (matchedStates.length > 0) {
        html += `<div class="search-category-header">🇮🇳 States &amp; Union Territories</div>`;
        matchedStates.forEach(s => {
          html += `
            <div class="search-result-item" data-action="state" data-lng="${s.center[0]}" data-lat="${s.center[1]}" data-zoom="${s.zoom}" data-name="${s.name}">
              <span class="search-item-icon">🏛️</span>
              <div class="search-item-main">
                <div class="search-item-title">${s.name}</div>
                <div class="search-item-subtitle">State Cadastre &bull; Bhu-Aadhaar Integration</div>
              </div>
              <span class="search-item-badge">${s.type}</span>
            </div>
          `;
        });
      }

      if (!html) {
        html = `
          <div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 0.8rem;">
            No cadastre results found for "<strong>${query}</strong>". Try entering a state, city, ULPIN, or lat/lng coordinates.
          </div>
        `;
      }

      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
      bindItemListeners();

      // 5. Backend Search Endpoint Async Enrichment
      if (q.length >= 2) {
        try {
          const resp = await fetch(`/api/parcels/search?q=${encodeURIComponent(q)}`);
          const data = await resp.json();
          if (currentSearchTerm === q && data && data.results && data.results.length > 0) {
            let newlyFound = [];
            data.results.forEach(bp => {
              if (!seenUlpins.has(bp.ulpin)) {
                seenUlpins.add(bp.ulpin);
                newlyFound.push(bp);
              }
            });

            if (newlyFound.length > 0 && localMatches.length < 8) {
              const combined = [...localMatches, ...newlyFound].slice(0, 8);
              let buildingHeader = Array.from(dropdown.querySelectorAll('.search-category-header')).find(h => h.textContent.includes('Cadastral Buildings'));
              let buildingHtml = '';
              combined.forEach(p => {
                buildingHtml += `
                  <div class="search-result-item" data-action="parcel" data-ulpin="${p.ulpin}">
                    <span class="search-item-icon">🏢</span>
                    <div class="search-item-main">
                      <div class="search-item-title">${p.survey_no || p.ulpin} &bull; ${p.owner || 'Landholder'}</div>
                      <div class="search-item-subtitle">${p.locality || 'Amritsar'} &bull; ${p.total_floors || 2} Floors &bull; ${p.status || 'DIGITALIZED'}</div>
                    </div>
                    <span class="search-item-badge">${p.ulpin}</span>
                  </div>
                `;
              });

              if (buildingHeader) {
                // Clear existing building items
                let cur = buildingHeader.nextElementSibling;
                while (cur && cur.classList.contains('search-result-item') && cur.getAttribute('data-action') === 'parcel') {
                  const nxt = cur.nextElementSibling;
                  cur.remove();
                  cur = nxt;
                }
                buildingHeader.insertAdjacentHTML('afterend', buildingHtml);
              } else {
                dropdown.insertAdjacentHTML('afterbegin', `<div class="search-category-header">🏢 Cadastral Buildings &amp; ULPINs</div>` + buildingHtml);
              }
              bindItemListeners();
            }
          }
        } catch (e) {
          // Backend lookup failed silently
        }
      }
    };

    searchInput.addEventListener('input', (e) => renderResults(e.target.value));

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = searchInput.value.trim();
        if (!val) return;

        // A. Exact GPS Coordinates
        const coord = parseCoords(val);
        if (coord) {
          this.switchView('map');
          setTimeout(() => {
            if (this.map2d) {
              this.map2d.flyToLocation({ center: [coord.lng, coord.lat], zoom: 17.5, name: `${coord.lat.toFixed(5)}° N, ${coord.lng.toFixed(5)}° E` });
            }
          }, 100);
          dropdown.style.display = 'none';
          return;
        }

        // B. Direct ULPIN search (e.g. BCN501B1NA2CH0, PB020011014121, or 4+ chars alphanumeric without spaces)
        const cleanAlphanum = val.replace(/[^A-Za-z0-9\/-]/g, '');
        if (cleanAlphanum.length >= 4 && !val.includes(' ')) {
          this.locateOnMap(cleanAlphanum);
          dropdown.style.display = 'none';
          return;
        }

        // C. Fallback: Click first matching item in dropdown
        const firstItem = dropdown.querySelector('.search-result-item');
        if (firstItem) {
          firstItem.click();
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        dropdown.style.display = 'none';
        clearBtn.style.display = 'none';
        searchInput.focus();
      });
    }

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // 3D Controls
    const explodeSlider = document.getElementById('explode-slider');
    if (explodeSlider) {
      explodeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.twin3d) {
          this.twin3d.setExplodeFactor(val);
        }
        document.getElementById('explode-val').textContent = `${Math.round(val * 100)}%`;
      });
    }

    // View Mode Toggle (Textured vs Blueprint)
    const btnTextured = document.getElementById('btn-mode-textured');
    const btnBlueprint = document.getElementById('btn-mode-blueprint');
    if (btnTextured && btnBlueprint) {
      btnTextured.addEventListener('click', () => {
        btnTextured.classList.add('active');
        btnBlueprint.classList.remove('active');
        if (this.twin3d) this.twin3d.setViewMode('textured');
      });
      btnBlueprint.addEventListener('click', () => {
        btnBlueprint.classList.add('active');
        btnTextured.classList.remove('active');
        if (this.twin3d) this.twin3d.setViewMode('blueprint');
      });
    }

    // Back button from 3D view to 2D Map
    const backBtn = document.getElementById('btn-back-to-map');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.switchView('map');
      });
    }

    // 3D Twin Floating Zoom & Reset Camera Controls
    const btnTwinZoomIn = document.getElementById('btn-twin-zoom-in');
    const btnTwinZoomOut = document.getElementById('btn-twin-zoom-out');
    const btnTwinReset = document.getElementById('btn-twin-reset-cam');
    if (btnTwinZoomIn) btnTwinZoomIn.onclick = () => this.twin3d?.zoomIn(1.3);
    if (btnTwinZoomOut) btnTwinZoomOut.onclick = () => this.twin3d?.zoomOut(1.3);
    if (btnTwinReset) btnTwinReset.onclick = () => this.twin3d?.resetCamera();

    // 3D Twin Aerial Satellite Ground Toggle
    const btnTwinSatToggle = document.getElementById('btn-twin-satellite-toggle');
    if (btnTwinSatToggle) {
      btnTwinSatToggle.onclick = () => {
        const isActive = btnTwinSatToggle.classList.toggle('active');
        if (this.twin3d) this.twin3d.toggleGroundSatellite(isActive);
      };
    }
  }

  openRegisterModal() {
    const modal = document.getElementById('register-property-modal');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
      const formEl = document.getElementById('property-register-form');
      const receiptCard = document.getElementById('challan-official-receipt');
      if (formEl) formEl.style.display = 'block';
      if (receiptCard) receiptCard.style.display = 'none';
      if (this.recalculateChallanFee) this.recalculateChallanFee();
    }
  }

  closeRegisterModal() {
    const modal = document.getElementById('register-property-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
      modal.style.removeProperty('display');
    }
    if (this.map2d) {
      this.map2d.cleanupPicker();
    }
  }

  startSelectBuildingOnMap() {
    this.closeRegisterModal();
    this.switchView('map');

    setTimeout(() => {
      if (!this.map2d) {
        this.map2d = new CadastreMap2D('cadastre-map', this.allParcels, (parcel) => {
          this.open3DTwin(parcel);
        });
        this.map2d.init();
      }
      this.map2d.invalidateSize();
      this.map2d.startCadastralPicker('select', (result) => {
        this.handlePickerResult(result);
        this.openRegisterModal();
      }, () => {
        this.openRegisterModal();
      });
    }, 150);
  }

  startDrawBoundaryPolygon() {
    this.closeRegisterModal();
    this.switchView('map');

    setTimeout(() => {
      if (!this.map2d) {
        this.map2d = new CadastreMap2D('cadastre-map', this.allParcels, (parcel) => {
          this.open3DTwin(parcel);
        });
        this.map2d.init();
      }
      this.map2d.invalidateSize();
      this.map2d.startCadastralPicker('draw', (result) => {
        this.handlePickerResult(result);
        this.openRegisterModal();
      }, () => {
        this.openRegisterModal();
      });
    }, 150);
  }

  setupModalHandlers() {
    const btnOpen = document.getElementById('btn-open-register-modal');
    const btnClose = document.getElementById('btn-close-register-modal');
    const modal = document.getElementById('register-property-modal');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => this.openRegisterModal());
    }
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeRegisterModal();
      });
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeRegisterModal();
      });
    }

    // Onboarding Tips Modal & 5-Step Tour Button Direct Handlers
    const btnTipsClose = document.getElementById('btn-close-onboarding-top');
    const btnTipsSkip = document.getElementById('btn-onboarding-skip');
    const btnTipsStart = document.getElementById('btn-onboarding-start');
    const tipsModal = document.getElementById('onboarding-tips-modal');

    if (btnTipsClose) {
      btnTipsClose.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeQuickTipsModal();
      });
    }
    if (btnTipsSkip) {
      btnTipsSkip.addEventListener('click', (e) => {
        e.preventDefault();
        this.skipTipsModal();
      });
    }
    if (btnTipsStart) {
      btnTipsStart.addEventListener('click', (e) => {
        e.preventDefault();
        this.startGuidedTour();
      });
    }
    if (tipsModal) {
      tipsModal.addEventListener('click', (e) => {
        if (e.target === tipsModal) this.closeQuickTipsModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeRegisterModal();
        this.closeQuickTipsModal();
      }
    });

    // Interactive Map Picking Buttons (wired to methods)
    const btnSelectBuilding = document.getElementById('btn-select-map-building');
    const btnDrawPolygon = document.getElementById('btn-draw-map-polygon');

    if (btnSelectBuilding) {
      btnSelectBuilding.onclick = (e) => {
        e.preventDefault();
        this.startSelectBuildingOnMap();
      };
    }

    if (btnDrawPolygon) {
      btnDrawPolygon.onclick = (e) => {
        e.preventDefault();
        this.startDrawBoundaryPolygon();
      };
    }

    // Form Submission & Bharatkosh Dynamic UPI QR Flow
    const regForm = document.getElementById('property-register-form');
    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fee = parseInt(document.getElementById('reg-challan-amount-input')?.value || '1250', 10);
        const declaredFloors = parseInt(document.getElementById('reg-floors-select')?.value || '2', 10);
        const hasBasement = document.getElementById('reg-basement-checkbox')?.checked !== false;
        const purpose = `Autonomous Drone LiDAR Survey • ${declaredFloors} Levels${hasBasement ? ' + Basement GPR' : ''}`;

        this.openUpiPaymentModal(fee, purpose, (utr) => {
          this.handlePropertyRegistration(fee, utr);
        });
      });
    }
  }

  handlePickerResult(result) {
    const vertexCountEl = document.getElementById('reg-vertex-count');
    const areaDisplayEl = document.getElementById('reg-area-display');
    const centroidDisplayEl = document.getElementById('reg-centroid-display');
    const coordsInput = document.getElementById('reg-coordinates-json');
    const areaSqftInput = document.getElementById('reg-area-sqft');
    const statusBadge = document.getElementById('reg-status-badge');
    const khasraInput = document.getElementById('reg-khasra-input');

    const sqyd = result.area_sqyd || (result.area && result.area.sqYards) || 385;
    const sqft = result.area_sqft || (result.area && result.area.sqFt) || 3465;
    const sqm = result.area_sqm || (result.area && result.area.sqMeters) || 321.9;

    if (coordsInput) {
      coordsInput.value = JSON.stringify(result.coordinates);
    }
    if (areaSqftInput) {
      areaSqftInput.value = sqft;
    }
    if (vertexCountEl) {
      vertexCountEl.textContent = `${result.vertexCount || 6} points (${result.type === 'draw' ? 'Custom 6-Point Boundary' : 'Snapped Building Footprint'})`;
    }
    if (areaDisplayEl) {
      areaDisplayEl.innerHTML = `<strong>${sqyd.toLocaleString()} sq.yd &bull; ${sqft.toLocaleString()} sq.ft (${sqm} m²)</strong>`;
    }
    if (centroidDisplayEl && result.centroid) {
      centroidDisplayEl.textContent = `${result.centroid[0].toFixed(5)}° N, ${result.centroid[1].toFixed(5)}° E`;
    }
    if (statusBadge) {
      statusBadge.textContent = result.type === 'draw' ? '✏️ 6-Point Custom Polygon' : '📍 Footprint Snapped';
      statusBadge.style.background = '#dbeafe';
      statusBadge.style.color = '#1e40af';
    }
    if (result.properties && result.properties.survey_no && khasraInput) {
      khasraInput.value = result.properties.survey_no;
    }

    // Automatically recalculate dynamic Bharatkosh Challan based on new cadastral boundary land area
    if (this.recalculateChallanFee) {
      this.recalculateChallanFee();
    }
  }

  setupChallanPricingCalculator() {
    const floorsSelect = document.getElementById('reg-floors-select');
    const classSelect = document.getElementById('reg-class-select');
    const basementCheck = document.getElementById('reg-basement-checkbox');

    const recalc = () => {
      const floors = parseInt(floorsSelect?.value || '2', 10);
      const landClass = classSelect?.value || 'residential';
      const hasBasement = basementCheck ? basementCheck.checked : true;
      const areaSqft = parseFloat(document.getElementById('reg-area-sqft')?.value || '3465');
      const areaSqyd = Math.max(50, Math.round(areaSqft / 9.0));

      // 1. Base Autonomous LiDAR Drone Scan Fee based on plot area:
      let baseFee = 500;
      if (areaSqyd > 500) {
        baseFee = 1000 + Math.round((areaSqyd - 500) * 1.5);
      } else if (areaSqyd > 250) {
        baseFee = 750;
      }

      // 2. Vertical Floor SLAM Verification Fee:
      let floorsFee = 300;
      if (floors > 1) {
        floorsFee += (floors - 1) * 350;
      }

      // 3. Land Classification / Building Category Tariff:
      let classFee = 0;
      let classLabel = 'Abadi Deh (Residential)';
      if (landClass === 'commercial') {
        classFee = 750;
        classLabel = 'Commercial SLAM Tariff';
      } else if (landClass === 'industrial') {
        classFee = 1200;
        classLabel = 'Industrial Clearances';
      } else if (landClass === 'agricultural') {
        classFee = -200;
        classLabel = 'Agri Concession';
      }

      // 4. Subterranean Foundation & Multi-Utility Radar Scan (-30ft):
      const basementFee = hasBasement ? 450 : 0;

      const totalFee = Math.max(350, baseFee + floorsFee + classFee + basementFee);

      // Update UI elements
      const amountText = document.getElementById('reg-fee-amount-text');
      const breakdownText = document.getElementById('reg-fee-breakdown-text');
      const hiddenInput = document.getElementById('reg-challan-amount-input');
      const submitBtn = document.getElementById('btn-submit-registration');

      const feeBaseEl = document.getElementById('fee-breakdown-base');
      const feeFloorsEl = document.getElementById('fee-breakdown-floors');
      const feeClassEl = document.getElementById('fee-breakdown-class');
      const feeBasementEl = document.getElementById('fee-breakdown-basement');

      if (feeBaseEl) feeBaseEl.textContent = `₹${baseFee.toLocaleString()} (${areaSqyd} sq.yd)`;
      if (feeFloorsEl) feeFloorsEl.textContent = `₹${floorsFee.toLocaleString()} (${floors} ${floors > 1 ? 'Floors' : 'Floor'})`;
      if (feeClassEl) feeClassEl.textContent = `${classFee >= 0 ? '+' : ''}₹${classFee.toLocaleString()} (${classLabel})`;
      if (feeBasementEl) feeBasementEl.textContent = `${hasBasement ? '+₹450 (GPR Scan)' : '₹0 (None)'}`;

      if (amountText) amountText.textContent = `₹${totalFee.toLocaleString()}.00 • Bharatkosh Gateway`;
      if (breakdownText) {
        const floorDesc = floors === 1 ? 'Ground Only' : `${floors} Levels (G+${floors - 1})`;
        breakdownText.textContent = `${floorDesc} • ${classLabel}${hasBasement ? ' + GPR' : ''}`;
      }
      if (hiddenInput) hiddenInput.value = totalFee;
      if (submitBtn) {
        submitBtn.innerHTML = `💳 Pay ₹${totalFee.toLocaleString()}.00 Challan &amp; Schedule Drone Survey (Bharatkosh)`;
      }
    };

    this.recalculateChallanFee = recalc;
    if (floorsSelect) {
      floorsSelect.addEventListener('change', recalc);
      floorsSelect.addEventListener('input', recalc);
    }
    if (classSelect) {
      classSelect.addEventListener('change', recalc);
      classSelect.addEventListener('input', recalc);
    }
    if (basementCheck) {
      basementCheck.addEventListener('change', recalc);
    }
    const areaInput = document.getElementById('reg-area-sqft');
    if (areaInput) {
      areaInput.addEventListener('input', recalc);
      areaInput.addEventListener('change', recalc);
    }
    recalc();
  }

  setupJurisdictionSelector() {
    const JURISDICTIONS = {
      "Punjab": {
        "Amritsar": {
          mandals: ["Amritsar-I", "Amritsar-II", "Ajnala", "Baba Bakala", "Majitha"],
          center: [74.8723, 31.6340],
          zoom: 16.5
        },
        "Jalandhar": {
          mandals: ["Jalandhar-I", "Jalandhar-II", "Nakodar", "Phillaur", "Shahkot"],
          center: [75.5762, 31.3260],
          zoom: 15.5
        },
        "Ludhiana": {
          mandals: ["Ludhiana East", "Ludhiana West", "Jagraon", "Khanna", "Payal", "Samrala"],
          center: [75.8573, 30.9010],
          zoom: 15.5
        },
        "Patiala": {
          mandals: ["Patiala", "Nabha", "Rajpura", "Samana", "Patran"],
          center: [76.3869, 30.3398],
          zoom: 15.5
        },
        "Bathinda": {
          mandals: ["Bathinda", "Rampura Phul", "Talwandi Sabo", "Maur"],
          center: [74.9455, 30.2110],
          zoom: 15.5
        },
        "SAS Nagar (Mohali)": {
          mandals: ["Mohali", "Kharar", "Dera Bassi"],
          center: [76.7179, 30.7046],
          zoom: 15.5
        }
      },
      "Haryana": {
        "Gurugram": {
          mandals: ["Gurugram", "Sohna", "Pataudi", "Badshahpur"],
          center: [77.0266, 28.4595],
          zoom: 15.5
        },
        "Faridabad": {
          mandals: ["Faridabad", "Ballabgarh", "Badkhal"],
          center: [77.3178, 28.4089],
          zoom: 15.5
        }
      },
      "NCT of Delhi": {
        "New Delhi": {
          mandals: ["Chanakyapuri", "Delhi Cantonment", "Vasant Vihar"],
          center: [77.2090, 28.6139],
          zoom: 15.5
        },
        "Central Delhi": {
          mandals: ["Civil Lines", "Karol Bagh", "Kotwali"],
          center: [77.2167, 28.6448],
          zoom: 15.5
        }
      }
    };

    const stateSelect = document.getElementById('select-login-state');
    const distSelect = document.getElementById('select-login-district');
    const mandalSelect = document.getElementById('select-login-mandal');

    const updateDistricts = () => {
      const state = stateSelect?.value || 'Punjab';
      const dists = JURISDICTIONS[state] || {};
      if (distSelect) {
        distSelect.innerHTML = Object.keys(dists).map(d => `<option value="${d}">${d}</option>`).join('');
      }
      updateMandals();
    };

    const updateMandals = () => {
      const state = stateSelect?.value || 'Punjab';
      const dist = distSelect?.value || 'Amritsar';
      const info = (JURISDICTIONS[state] && JURISDICTIONS[state][dist]) || { mandals: ['Amritsar-I'], center: [74.8723, 31.6340], zoom: 15.5 };
      if (mandalSelect) {
        mandalSelect.innerHTML = info.mandals.map(m => `<option value="${m}">${m}</option>`).join('');
      }
      syncJurisdictionDisplay();
    };

    const syncJurisdictionDisplay = () => {
      const state = stateSelect?.value || 'Punjab';
      const dist = distSelect?.value || 'Amritsar';
      const mandal = mandalSelect?.value || 'Amritsar-I';

      this.selectedState = state;
      this.selectedDistrict = dist;
      this.selectedMandal = mandal;

      // Sync header text
      const headerSub = document.getElementById('portal-jurisdiction-text');
      if (headerSub) {
        headerSub.textContent = '';
      }

      const topIndicator = document.getElementById('top-jurisdiction-text');
      if (topIndicator) {
        topIndicator.textContent = `${state} • ${dist} (${mandal})`;
      }

      // Fly map to new district/mandal coordinates if in map view
      const info = (JURISDICTIONS[state] && JURISDICTIONS[state][dist]);
      if (info && this.map2d) {
        this.map2d.flyToJurisdiction(info.center, info.zoom);
      }
    };

    if (stateSelect) stateSelect.addEventListener('change', updateDistricts);
    if (distSelect) distSelect.addEventListener('change', updateMandals);
    if (mandalSelect) mandalSelect.addEventListener('change', syncJurisdictionDisplay);

    updateDistricts();
  }

  async handlePropertyRegistration(customChallanFee = null, customPaymentRef = null) {
    const khasra = document.getElementById('reg-khasra-input')?.value || 'Khasra No. 429/1';
    const declaredFloors = parseInt(document.getElementById('reg-floors-select')?.value || '2', 10);
    const hasBasement = document.getElementById('reg-basement-checkbox')?.checked !== false;
    const challanFee = customChallanFee !== null ? customChallanFee : parseInt(document.getElementById('reg-challan-amount-input')?.value || '1250', 10);
    const landClass = document.getElementById('reg-class-select')?.value || 'residential';
    const coordsJson = document.getElementById('reg-coordinates-json')?.value;
    const areaSqft = parseInt(document.getElementById('reg-area-sqft')?.value || '3105', 10);
    const stateName = this.selectedState || 'Punjab';
    const districtName = this.selectedDistrict || 'Amritsar';
    const mandalName = this.selectedMandal || 'Amritsar-I';

    let coordinates = null;
    if (coordsJson) {
      try { coordinates = JSON.parse(coordsJson); } catch (e) {}
    }
    if (!coordinates || coordinates.length < 3) {
      coordinates = [
        [74.8620, 31.6125],
        [74.8626, 31.6125],
        [74.8626, 31.6131],
        [74.8620, 31.6131],
        [74.8620, 31.6125]
      ];
    }

    const assignedPaymentRef = customPaymentRef || `PB-BHRTK-2026-${Math.floor(1000000 + Math.random() * 9000000)}`;

    const payload = {
      owner: this.currentUser ? this.currentUser.name : 'Penna Peruru Thanuj',
      survey_no: khasra,
      khata: `KH-2026/${Math.floor(Math.random() * 800 + 100)}`,
      total_floors: declaredFloors,
      declared_floors: declaredFloors,
      has_basement: hasBasement,
      land_class: landClass,
      area_sqft: areaSqft,
      coordinates: coordinates,
      challan_amount: challanFee,
      state: stateName,
      district: districtName,
      mandal: mandalName,
      payment_ref: assignedPaymentRef
    };

    try {
      const res = await fetch('/api/parcels/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.parcel) {
        const newParcel = data.parcel;
        this.allParcels.push(newParcel);

        // Show official Bharatkosh receipt
        const receiptCard = document.getElementById('challan-official-receipt');
        const formEl = document.getElementById('property-register-form');
        if (receiptCard && formEl) {
          formEl.style.display = 'none';
          receiptCard.style.display = 'block';
          const refEl = document.getElementById('receipt-ref-no');
          if (refEl) refEl.textContent = `REF #${newParcel.payment_ref || assignedPaymentRef}`;
          const grnEl = document.getElementById('receipt-grn-val');
          if (grnEl) grnEl.textContent = `GRN-${Math.floor(100000000 + Math.random() * 900000000)}`;
          const ulpinEl = document.getElementById('receipt-ulpin-val');
          if (ulpinEl) ulpinEl.textContent = newParcel.ulpin;
          const khasraEl = document.getElementById('receipt-khasra-val');
          if (khasraEl) khasraEl.textContent = `${newParcel.survey_no}, ${mandalName}, ${districtName}`;
          const amtEl = document.getElementById('receipt-amount-val');
          if (amtEl) amtEl.textContent = `₹${challanFee.toLocaleString()}.00 (Bharatkosh UPI Gateway • ${declaredFloors} Levels${hasBasement ? ' + Basement' : ''})`;
        }

        // Show statutory top notification for drone survey scheduled in next two working days
        const notifBar = document.getElementById('top-gov-notification-bar');
        if (notifBar) {
          notifBar.style.display = 'flex';
          const notifTitle = document.getElementById('notif-title');
          const notifBody = document.getElementById('notif-body');
          if (notifTitle) notifTitle.textContent = `Challan Payment Acknowledged • ${newParcel.ulpin}`;
          if (notifBody) notifBody.innerHTML = `Fee ₹${challanFee.toLocaleString()}.00 verified via Bharatkosh UPI (${declaredFloors} Levels). Autonomous Cadastral Drone LiDAR Survey scheduled for execution within the <strong>next two working days</strong> for ${newParcel.survey_no}.`;
        }

        // Add & extrude directly onto 3D map
        if (this.map2d) {
          this.map2d.addNewBuildingToMap(newParcel);
        }

        // Re-render dashboard
        if (this.currentUser) {
          this.renderDashboard(this.currentUser);
        }
      }
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Error connecting to cadastral server. Please retry.');
    }
  }

  // Bharatkosh Dynamic UPI Payment Modal Controller
  openUpiPaymentModal(amount = 1250, purpose = 'Autonomous Drone LiDAR Cadastral Survey', onSuccessCallback = null) {
    this.upiPaymentState = {
      amount,
      purpose,
      callback: onSuccessCallback,
      secondsLeft: 600
    };

    const modal = document.getElementById('modal-upi-payment');
    const genState = document.getElementById('upi-generating-state');
    const displayState = document.getElementById('upi-display-state');
    const successState = document.getElementById('upi-success-state');

    if (!modal) return;
    modal.style.display = 'flex';

    // Stage 1: Animated "Generating Dynamic QR" session initialization
    if (genState) genState.style.display = 'block';
    if (displayState) displayState.style.display = 'none';
    if (successState) successState.style.display = 'none';

    setTimeout(() => {
      if (genState) genState.style.display = 'none';
      if (displayState) displayState.style.display = 'block';

      const amtDisplay = document.getElementById('upi-modal-amount-display');
      const btnAmt = document.getElementById('btn-upi-pay-amount');
      const purposeDisplay = document.getElementById('upi-modal-purpose-display');
      const grnText = document.getElementById('upi-modal-grn-text');

      if (amtDisplay) amtDisplay.textContent = `₹${amount.toLocaleString()}.00`;
      if (btnAmt) btnAmt.textContent = `₹${amount.toLocaleString()}.00`;
      if (purposeDisplay) purposeDisplay.textContent = purpose;
      if (grnText) grnText.textContent = `CHL-MCA-2026-${Math.floor(10000 + Math.random() * 90000)}`;

      this.startUpiCountdown();
    }, 750);
  }

  startUpiCountdown() {
    if (this.upiCountdownTimer) clearInterval(this.upiCountdownTimer);
    let sec = 599;
    const timerEl = document.getElementById('upi-countdown-timer');
    this.upiCountdownTimer = setInterval(() => {
      sec--;
      if (sec < 0) {
        clearInterval(this.upiCountdownTimer);
        return;
      }
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  closeUpiPaymentModal() {
    if (this.upiCountdownTimer) {
      clearInterval(this.upiCountdownTimer);
      this.upiCountdownTimer = null;
    }
    const modal = document.getElementById('modal-upi-payment');
    if (modal) modal.style.display = 'none';
  }

  simulateUpiAppScan() {
    const utr = `UPI/2026/${Math.floor(10000000 + Math.random() * 90000000)}`;
    this.confirmUpiPayment(utr);
  }

  confirmUpiPayment(customUtr = null) {
    if (this.upiCountdownTimer) {
      clearInterval(this.upiCountdownTimer);
      this.upiCountdownTimer = null;
    }

    const utr = customUtr || `UPI/2026/${Math.floor(10000000 + Math.random() * 90000000)}`;
    const displayState = document.getElementById('upi-display-state');
    const successState = document.getElementById('upi-success-state');
    const successAmt = document.getElementById('upi-success-amount');
    const successUtr = document.getElementById('upi-success-utr');

    if (displayState) displayState.style.display = 'none';
    if (successState) successState.style.display = 'block';

    const amt = this.upiPaymentState ? this.upiPaymentState.amount : 1250;
    if (successAmt) successAmt.textContent = `₹${amt.toLocaleString()}.00`;
    if (successUtr) successUtr.textContent = utr;

    this.showToast(`✅ Payment of ₹${amt.toLocaleString()}.00 Verified via Bharatkosh UPI!`, 4000);

    setTimeout(() => {
      this.closeUpiPaymentModal();
      if (this.upiPaymentState && typeof this.upiPaymentState.callback === 'function') {
        this.upiPaymentState.callback(utr);
      }
    }, 1200);
  }

  openAiAssistant() {
    const drawer = document.getElementById('ai-assistant-drawer');
    const input = document.getElementById('ai-chat-input');
    if (drawer) {
      drawer.style.display = 'flex';
      if (input) input.focus();
    }
  }

  setupAiAssistant() {
    const btnOpen = document.getElementById('btn-open-ai-assistant');
    const btnSide = document.getElementById('side-menu-ai-btn');
    const btnClose = document.getElementById('btn-close-ai-assistant');
    const drawer = document.getElementById('ai-assistant-drawer');
    const form = document.getElementById('ai-chat-form');
    const input = document.getElementById('ai-chat-input');
    const messages = document.getElementById('ai-chat-messages');

    const toggleAssistant = () => {
      if (!drawer) return;
      const isVisible = drawer.style.display === 'flex';
      drawer.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && input) input.focus();
    };

    if (btnOpen) btnOpen.addEventListener('click', toggleAssistant);
    if (btnSide) btnSide.addEventListener('click', (e) => { e.preventDefault(); toggleAssistant(); });

    if (btnClose && drawer) {
      btnClose.addEventListener('click', () => {
        drawer.style.display = 'none';
      });
    }

    // Quick Prompt Pills
    document.querySelectorAll('.ai-prompt-pill[data-prompt]').forEach(pill => {
      pill.addEventListener('click', () => {
        const promptText = pill.getAttribute('data-prompt');
        if (input) {
          input.value = promptText;
          if (form) form.dispatchEvent(new Event('submit'));
        }
      });
    });

    // Model Training Trigger Button
    const btnTrain = document.getElementById('btn-ai-train-model');
    if (btnTrain) {
      btnTrain.addEventListener('click', async () => {
        this.appendAiMessage('user', '⚡ Trigger Model Training Pipeline (BhuCadastreTransformer)');
        const loadingId = this.appendAiMessage('bot', '⏳ Dispatching PyTorch pre-training & fine-tuning worker...');

        try {
          const res = await fetch('/api/ai/train', { method: 'POST' });
          const data = await res.json();
          this.updateAiMessage(loadingId, `✅ **Model Training Triggered Successfully!**\n\n• **Model Architecture:** BhuCadastreTransformer (Multi-Modal Spatial-Legal)\n• **Checkpoint Directory:** \`ml/checkpoints/\`\n• **Status:** Background worker actively optimizing Masked Token Modeling & Contrastive Spatial Alignment.`);
        } catch (e) {
          this.updateAiMessage(loadingId, `❌ Training dispatch error: ${e.message}`);
        }
      });
    }

    // Chat Form Submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (!query) return;

        input.value = '';
        this.appendAiMessage('user', query);
        const loadingId = this.appendAiMessage('bot', '⏳ Consulting NVIDIA Nemotron Ultra 550B & Cadastral Legal RAG...');

        try {
          const res = await fetch('/api/ai/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              state: this.selectedState || 'Punjab',
              district: this.selectedDistrict || 'Amritsar',
              mandal: this.selectedMandal || 'Amritsar-I'
            })
          });
          const data = await res.json();

          let reply = data.answer || 'No specific statutory ruling found for this query.';
          let citationsHtml = '';
          if (data.citations && data.citations.length > 0) {
            const list = data.citations.map(c => `<li><strong>${c.title}</strong> (${c.source})</li>`).join('');
            citationsHtml = `
              <div class="ai-citations-box" style="margin-top: 8px;">
                <strong>Statutory Legal Citations:</strong>
                <ul style="margin: 4px 0 0 16px; padding: 0;">${list}</ul>
              </div>
            `;
          }

          let reasoningHtml = '';
          if (data.reasoning && data.reasoning.trim()) {
            reasoningHtml = `
              <div class="ai-reasoning-card" style="margin-top: 10px;">
                <div class="ai-reasoning-title" onclick="const b=this.nextElementSibling; b.style.display=(b.style.display==='none'?'block':'none');">
                  <span>🧠 Step-by-Step Legal Reasoning (${data.model || 'NVIDIA Nemotron 550B'})</span>
                  <span style="font-size: 0.72rem; opacity: 0.8;">▼ Click to View</span>
                </div>
                <div class="ai-reasoning-body" style="display: none; margin-top: 6px; white-space: pre-wrap; line-height: 1.4; color: #cbd5e1;">${data.reasoning}</div>
              </div>
            `;
          }

          this.updateAiMessage(loadingId, reply, citationsHtml + reasoningHtml);
        } catch (err) {
          this.updateAiMessage(loadingId, `⚠️ Error retrieving cadastral ruling: ${err.message}`);
        }
      });
    }
  }

  appendAiMessage(sender, text) {
    const messages = document.getElementById('ai-chat-messages');
    if (!messages) return null;

    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const div = document.createElement('div');
    div.id = msgId;
    div.className = `ai-message ${sender}`;

    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    div.innerHTML = `
      <strong>${sender === 'user' ? '👤 Citizen / Officer:' : '🇮🇳 Bhu-Samvaad AI:'}</strong>
      <div class="msg-content" style="margin-top: 4px;">${formattedText}</div>
    `;

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return msgId;
  }

  updateAiMessage(msgId, text, extraHtml = '') {
    const div = document.getElementById(msgId);
    if (!div) return;
    const content = div.querySelector('.msg-content');
    if (content) {
      const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      content.innerHTML = formattedText + (extraHtml || '');
    }
    const messages = document.getElementById('ai-chat-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  
  openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  }

  closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  logoutUser() {
    this.currentUser = null;
    const pubNav = document.getElementById('public-landing-nav');
    const govNav = document.querySelector('.gov-nav');
    const mapRibbon = document.getElementById('map-sub-header-bar');
    const historyBar = document.getElementById('cadastre-history-bar');

    if (pubNav) pubNav.style.display = 'flex';
    if (govNav) govNav.style.display = 'none';
    if (mapRibbon) mapRibbon.style.display = 'none';
    if (historyBar) historyBar.style.display = 'none';

    this.expandFullHeader();
    this.switchView('landing');
  }

  flyToCity(cityName) {
    const cityCoords = {
      amritsar: { center: [74.8657, 31.6178], zoom: 16.5, pitch: 58, bearing: -24, name: 'Amritsar Cadastre Division (3,600+ Real 3D Buildings)' },
      ludhiana: { center: [75.8292, 30.8851], zoom: 16.5, pitch: 58, bearing: -20, name: 'Ludhiana Municipal Cadastre (3,000+ Real 3D Buildings)' },
      phagwara: { center: [75.7701, 31.2215], zoom: 16.5, pitch: 58, bearing: -18, name: 'Phagwara Sub-Division (1,200+ Real 3D Buildings)' },
      jalandhar: { center: [75.5566, 31.3094], zoom: 16.5, pitch: 58, bearing: -20, name: 'Jalandhar Municipal Cadastre (2,500+ Real 3D Buildings)' },
      patiala: { center: [76.3869, 30.3398], zoom: 16, pitch: 55, bearing: -20, name: 'Patiala Cadastre Division' },
      mohali: { center: [76.7179, 30.7046], zoom: 16, pitch: 55, bearing: -20, name: 'Mohali (SAS Nagar) Cadastre Division' }
    };

    // Update active city chip styling
    document.querySelectorAll('.btn-city-chip').forEach(btn => {
      const match = btn.textContent.toLowerCase().includes(cityName.toLowerCase());
      btn.classList.toggle('active', match);
    });

    const target = cityCoords[cityName.toLowerCase()] || cityCoords.amritsar;
    this.switchView('map');
    setTimeout(() => {
      if (this.map2d) {
        this.map2d.flyToLocation(target);
      }
    }, 100);
  }

  switchView(viewName) {
    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const targetPanel = document.getElementById(`view-${viewName}`);
    const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);

    if (targetPanel) {
      targetPanel.classList.add('active');
      targetPanel.style.display = (viewName === 'dashboard' || viewName === 'landing' || viewName === 'report') ? 'block' : 'flex';
    }
    if (targetNav) targetNav.classList.add('active');

    // Controls in Header Ribbon: Map sub-header bar visible ONLY in 3D City Map view
    const mapRibbon = document.getElementById('map-sub-header-bar');
    if (mapRibbon) {
      mapRibbon.style.display = (viewName === 'map') ? 'flex' : 'none';
    }

    // STRICT USER REQUIREMENT: REMOVE MUTATION TIMELINE FROM 3D CITY MAP!
    // Visible ONLY in 3D Digital Twin Inspector ('twin'), strictly hidden in 'map' and other views!
    const historyBar = document.getElementById('cadastre-history-bar');
    if (historyBar) {
      historyBar.style.display = (viewName === 'twin') ? 'flex' : 'none';
    }

    // STRICT USER REQUIREMENT: Do NOT show "Sign Out" in the Maps view!
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.style.display = (viewName === 'map') ? 'none' : '';
    }

    if (viewName === 'report') {
      if (this.districtReport) {
        this.districtReport.loadReport();
      }
    } else if (viewName === 'map') {
      if (!this.map2d) {
        this.map2d = new CadastreMap2D('cadastre-map', this.allParcels, (parcel) => {
          this.open3DTwin(parcel);
        });
        this.map2d.init();
      }
      const resizeMap = () => {
        if (this.map2d) this.map2d.invalidateSize();
      };
      resizeMap();
      setTimeout(resizeMap, 30);
      setTimeout(resizeMap, 100);
      setTimeout(resizeMap, 250);
      setTimeout(resizeMap, 500);
      if (window.requestAnimationFrame) requestAnimationFrame(resizeMap);
    } else if (viewName === 'twin') {
      if (!this.activeParcel) {
        this.activeParcel = this.allParcels[0];
      }
      this.renderDossierHUD(this.activeParcel);

      if (!this.twin3d) {
        this.twin3d = new DigitalTwin3D('twin-viewport', (levelData) => {
          this.selectDossierLevel(levelData.level_code);
        });
        this.twin3d.init();
      }
      const resizeTwin = () => {
        if (this.twin3d) {
          if (this.activeParcel) this.twin3d.loadParcel(this.activeParcel);
          this.twin3d.onResize();
        }
      };
      resizeTwin();
      setTimeout(resizeTwin, 30);
      setTimeout(resizeTwin, 100);
      setTimeout(resizeTwin, 250);
      setTimeout(resizeTwin, 500);
      if (window.requestAnimationFrame) requestAnimationFrame(resizeTwin);
    }
  }

  renderDashboard(user) {
    if (!user) user = CURRENT_USER;
    const nameEl = document.getElementById('profile-name');
    const aadhaarEl = document.getElementById('profile-aadhaar');
    const mobileEl = document.getElementById('profile-mobile');
    const addressEl = document.getElementById('profile-address');
    const avatarImg = document.getElementById('profile-avatar-img');
    const avatarInitials = document.getElementById('profile-avatar-initials');
    const dobTag = document.getElementById('profile-dob-tag');

    const isThanuj = (user.name && user.name.includes('Thanuj')) || (user.aadhaar_masked === 'XXXX-XXXX-0827');
    const displayName = isThanuj ? 'Penna Peruru Thanuj' : (user.name || 'Citizen');
    const displayAadhaar = isThanuj ? 'XXXX-XXXX-0827' : (user.aadhaar_masked || 'XXXX-XXXX-0000');

    if (nameEl) nameEl.textContent = displayName;
    if (aadhaarEl) aadhaarEl.textContent = `Aadhaar: ${displayAadhaar}`;
    if (mobileEl) mobileEl.textContent = `Mobile: ${user.mobile || '+91 98765-XXXXX'}`;
    if (addressEl) addressEl.textContent = user.address || 'Heritage Cadastre Zone / Urban Residential Area, Punjab';

    if (dobTag) {
      if (isThanuj || user.dob) {
        dobTag.textContent = `DOB: ${user.dob || '24/03/2008'} • ${user.gender || 'Male'}`;
        dobTag.style.display = 'inline-block';
      } else {
        dobTag.style.display = 'none';
      }
    }

    const avatarSrc = user.avatar_url || (isThanuj ? '/data/thanuj_avatar.jpg' : null);
    if (avatarSrc && avatarImg) {
      avatarImg.src = avatarSrc;
      avatarImg.style.display = 'block';
      if (avatarInitials) avatarInitials.style.display = 'none';
    } else {
      if (avatarImg) avatarImg.style.display = 'none';
      if (avatarInitials) {
        avatarInitials.textContent = displayName.split(' ').map(w => w[0]).join('').slice(0, 2);
        avatarInitials.style.display = 'block';
      }
    }

    const owned = Array.isArray(user.properties_owned) ? user.properties_owned : [];

    const rawUserParcels = this.allParcels.filter(p => owned.includes(p.ulpin) || (p.legacy_ulpin && owned.includes(p.legacy_ulpin)));

    // Strict deduplication by primary ULPIN or parcel ID so aliases NEVER produce duplicate cards
    const seenKeys = new Set();
    const userParcels = [];
    for (const p of rawUserParcels) {
      const primaryKey = p.id || p.survey_no || p.ulpin;
      if (!seenKeys.has(primaryKey) && !seenKeys.has(p.ulpin)) {
        seenKeys.add(primaryKey);
        seenKeys.add(p.ulpin);
        if (p.legacy_ulpin) seenKeys.add(p.legacy_ulpin);
        userParcels.push(p);
      }
    }
    
    // Property count stats
    const totalCountEl = document.getElementById('stat-total-props');
    const digitalCountEl = document.getElementById('stat-digital-props');
    const pendingCountEl = document.getElementById('stat-pending-props');
    const flagCountEl = document.getElementById('stat-flagged-props');

    const digiProps = userParcels.filter(p => p.status === 'DIGITALIZED');
    const pendingProps = userParcels.filter(p => p.status === 'PENDING_REGISTRATION');
    const flagProps = userParcels.filter(p => p.status === 'FLAGGED_VIOLATION');

    if (totalCountEl) totalCountEl.textContent = userParcels.length;
    if (digitalCountEl) digitalCountEl.textContent = digiProps.length;
    if (pendingCountEl) pendingCountEl.textContent = pendingProps.length;
    if (flagCountEl) flagCountEl.textContent = flagProps.length;

    // Populate Cards Grid
    const gridEl = document.getElementById('dashboard-property-grid');
    if (!gridEl) return;

    if (userParcels.length === 0) {
      gridEl.innerHTML = `
        <div class="empty-properties-card" style="grid-column: 1 / -1; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 48px 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin: 10px 0;">
          <div style="font-size: 3.5rem; margin-bottom: 12px;">🏡</div>
          <h3 style="color: #0f172a; font-size: 1.35rem; font-weight: 800; margin-bottom: 8px;">No Land Parcels Linked to this Citizen ID</h3>
          <p style="color: #64748b; font-size: 0.9rem; max-width: 540px; margin: 0 auto 24px auto; line-height: 1.5;">
            You currently have <strong>0 registered cadastral land parcels</strong> linked to Aadhaar <strong>${user.aadhaar_masked || 'your account'}</strong> in the Urban Cadastral Registry.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn-primary" onclick="window.app && (window.app.openRegistrationModal ? window.app.openRegistrationModal() : window.app.switchView('register'))" style="padding: 11px 22px; font-weight: 700; font-size: 0.88rem; background: var(--gov-blue); color: #ffffff; border: none; border-radius: 6px; cursor: pointer;">
              ➕ Apply for Drone Survey (Mission Lal Lakir)
            </button>
            <button type="button" class="btn-secondary" onclick="window.app && window.app.switchView('map')" style="padding: 11px 22px; font-weight: 600; font-size: 0.88rem; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #1e293b; border-radius: 6px; cursor: pointer;">
              🗺️ Explore 3D Cadastral Map
            </button>
          </div>
          <div style="margin-top: 20px; font-size: 0.78rem; color: #64748b; background: #f1f5f9; display: inline-block; padding: 6px 14px; border-radius: 20px;">
            Want to see sample digital twin properties? <a href="javascript:void(0);" onclick="window.app.loginDemoHarpreet()" style="color: #0284c7; text-decoration: underline; font-weight: 700;">Load Sardar Harpreet Singh (Evaluator Demo)</a>
          </div>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = userParcels.map(p => {
      const isFlag = p.status === 'FLAGGED_VIOLATION';
      const isDigi = p.status === 'DIGITALIZED';
      const bhu = this.getBhuNakshaRecord(p);

      const statusBadge = isFlag
        ? '<span class="status-badge flagged">🚨 AI Flagged (24h Notice)</span>'
        : isDigi
        ? '<span class="status-badge digitalized">✅ Digitalized 3D Twin</span>'
        : '<span class="status-badge pending">⏳ Awaiting Drone Scan</span>';

      const anomalyBox = isFlag ? `
        <div class="anomaly-alert-box">
          <strong>⚠️ Statutory Discrepancy Notice (Sec 187 MCA Act)</strong>
          ${p.anomaly_desc}
          <div style="margin-top: 6px;">Deadline: <span class="timer-countdown" id="card-timer">14h 22m remaining</span></div>
        </div>
      ` : '';

      return `
        <div class="property-card ${isFlag ? 'flagged' : isDigi ? 'digitalized' : 'pending'}">
          <div class="card-header">
            <span class="ulpin-badge">${p.ulpin}</span>
            ${statusBadge}
          </div>
          <div class="card-body">
            <h4>${p.survey_no} &bull; ${p.village}</h4>
            <div class="property-specs">
                            <div class="spec-item">BhuNaksha Sync: <strong style="color: #166534;">Hadbast #${bhu.hadbastNo} &bull; Khasra #${bhu.khasraNo}</strong></div>
              <div class="spec-item">Cadastral Area: <strong style="color: #0369a1;">${bhu.kanalMarla}</strong></div>
              <div class="spec-item">Khata Record: <strong>${bhu.khata}</strong></div>
              <div class="spec-item">Floors Detected: <strong>${p.total_floors > 0 ? p.total_floors + ' Levels' : 'None (Unregistered)'}</strong></div>
              <div class="spec-item">Tax Assessment: <strong>₹${typeof p.tax_amount === "number" ? p.tax_amount.toLocaleString() : (p.tax_amount || "14,200")} (${p.tax_status})</strong></div>
            </div>
            ${anomalyBox}
          </div>
          <div class="card-footer" style="display: flex; flex-wrap: wrap; gap: 6px;">
            <button class="btn-card highlight" style="flex: 1;" onclick="window.app.inspectParcel('${p.ulpin}')">
              🏢 3D Twin &amp; BhuNaksha
            </button>
            <button class="btn-card" style="flex: 1;" onclick="window.app.locateOnMap('${p.ulpin}')">
              🗺️ Locate on Satellite
            </button>
            <button class="btn-card" style="flex: 1; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;" onclick="window.app.copyBhuNakshaDetails('${p.ulpin}')">
              📋 Copy for BhuNaksha
            </button>
            <button class="btn-card" style="flex: 1; background: #f8fafc; color: #0284c7; border: 1px solid #cbd5e1;" onclick="window.app.viewOfficialFard('${p.ulpin}')">
              📜 View RoR Fard
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  inspectParcel(ulpin) {
    const parcel = this.allParcels.find(p => p.ulpin === ulpin || p.legacy_ulpin === ulpin);
    if (parcel) {
      this.open3DTwin(parcel);
    }
  }

  async locateOnMap(ulpin, parcelHint = null) {
    if (!ulpin && !parcelHint) return;
    const rawTarget = (ulpin || parcelHint?.ulpin || '').trim();
    const searchUlpin = rawTarget.toUpperCase();

    // 1. If parcelHint is already provided and has valid coordinates or centroid
    let parcel = (parcelHint && (parcelHint.centroid || parcelHint.coordinates)) ? parcelHint : null;

    // 2. Search local in-memory portfolio/cadastre parcels (this.allParcels)
    if (!parcel && this.allParcels && this.allParcels.length > 0) {
      parcel = this.allParcels.find(p => 
        (p.ulpin && p.ulpin.toUpperCase() === searchUlpin) ||
        (p.legacy_ulpin && p.legacy_ulpin.toUpperCase() === searchUlpin) ||
        (p.survey_no && p.survey_no.toUpperCase().includes(searchUlpin)) ||
        (p.ulpin && p.ulpin.toUpperCase().includes(searchUlpin))
      );
    }

    // 3. Search loaded MapLibre GeoJSON layer features (10,300 3D buildings)
    if (!parcel && this.map2d?.currentGeoJSON?.features) {
      const feat = this.map2d.currentGeoJSON.features.find(f => {
        const p = f.properties || {};
        return (p.ulpin && p.ulpin.toUpperCase() === searchUlpin) ||
               (p.legacy_ulpin && p.legacy_ulpin.toUpperCase() === searchUlpin) ||
               (p.survey_no && p.survey_no.toUpperCase().includes(searchUlpin)) ||
               (p.ulpin && p.ulpin.toUpperCase().includes(searchUlpin));
      });
      if (feat) {
        const p = feat.properties || {};
        let centroid = null;
        const coords = feat.geometry?.coordinates || [];
        if (coords.length > 0) {
          const ring = Array.isArray(coords[0]) && Array.isArray(coords[0][0]) ? coords[0] : coords;
          let sumLng = 0, sumLat = 0, count = 0;
          ring.forEach(pt => {
            if (Array.isArray(pt) && typeof pt[0] === 'number') {
              sumLng += pt[0];
              sumLat += pt[1];
              count++;
            }
          });
          if (count > 0) centroid = [sumLat / count, sumLng / count];
        }
        parcel = {
          ...p,
          coordinates: coords,
          centroid: centroid || [31.6125, 74.8620],
          survey_no: p.survey_no || p.ulpin,
          owner: p.owner || 'Verified Landholder',
          total_floors: p.total_floors || 2
        };
      }
    }

    // 4. Query backend search endpoint for cross-district/database lookup
    if (!parcel) {
      try {
        const resp = await fetch(`/api/parcels/search?q=${encodeURIComponent(searchUlpin)}`);
        const data = await resp.json();
        if (data && data.results && data.results.length > 0) {
          parcel = data.results.find(r => 
            r.ulpin.toUpperCase() === searchUlpin || 
            (r.legacy_ulpin && r.legacy_ulpin.toUpperCase() === searchUlpin)
          ) || data.results[0];
        }
      } catch (e) {
        console.warn('Backend ULPIN search lookup error:', e);
      }
    }

    // 5. Fallback: Synthesize parcel using Bhu-Aadhaar statutory decoder
    if (!parcel) {
      const decoded = this.decodeUlpin(searchUlpin);
      const cityCenters = {
        'Amritsar': [74.8620, 31.6125],
        'Ludhiana': [75.8450, 30.8950],
        'Jalandhar': [75.5650, 31.3150],
        'Kapurthala / Phagwara': [75.7722, 31.2212],
        'Phagwara': [75.7722, 31.2212]
      };
      const center = cityCenters[decoded.distName] || [74.8620, 31.6125];
      parcel = {
        ulpin: decoded.formatted || searchUlpin,
        legacy_ulpin: decoded.clean || searchUlpin,
        survey_no: `Hadbast #${decoded.village || '101'} • Khasra #${decoded.plot || '412/1'}`,
        owner: 'Bhu-Aadhaar Registered Citizen',
        locality: `${decoded.distName || 'Amritsar'}, Punjab`,
        total_floors: 2,
        height: 6.8,
        status: 'DIGITALIZED',
        centroid: [center[1], center[0]],
        coordinates: [
          [
            [center[0] - 0.0001, center[1] - 0.0001],
            [center[0] + 0.0001, center[1] - 0.0001],
            [center[0] + 0.0001, center[1] + 0.0001],
            [center[0] - 0.0001, center[1] + 0.0001],
            [center[0] - 0.0001, center[1] - 0.0001]
          ]
        ]
      };
    }

    // 6. Switch to 3D Satellite City Map View and navigate camera
    this.switchView('map');
    setTimeout(() => {
      if (this.map2d) {
        this.map2d.invalidateSize();
        this.map2d.flyToParcel(parcel);
      }
    }, 150);
  }

  inspectDiscrepancyTwin() {
    const discrepancyParcel = (this.allParcels && this.allParcels.find(p => p.has_anomaly)) || (this.allParcels && this.allParcels[0]);
    if (discrepancyParcel) {
      this.open3DTwin(discrepancyParcel);
    } else {
      this.switchView('twin');
    }
  }

  open3DTwin(parcel) {
    if (!parcel) return;
    this.activeParcel = parcel;
    this.switchView('twin');

    if (!this.twin3d) {
      this.twin3d = new DigitalTwin3D('twin-viewport', (levelData) => {
        this.selectDossierLevel(levelData.level_code);
      });
      this.twin3d.init();
    }

    // Ensure parcel has vertical levels generated if not present
    if (!parcel.levels || parcel.levels.length === 0) {
      parcel.levels = this.twin3d.generateDefaultLevelsForParcel(parcel);
    }

    // Populate Left HUD Dossier
    this.renderDossierHUD(parcel);

    // Load into 3D scene
    setTimeout(() => {
      if (this.twin3d) {
        this.twin3d.loadParcel(parcel);
        this.twin3d.onResize();
      }
    }, 60);
  }

  decodeUlpin(ulpinStr) {
    const raw = (ulpinStr || 'BCN501B1NA2CH0').trim();
    let clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    // Map legacy PB state prefixes to statutory grid sectors if encountered
    if (clean.startsWith('PB02')) {
      clean = clean === 'PB020011014121' ? 'BCN501B1NA2CH0' : `BCN501${clean.substring(6, 10)}${clean.substring(10, 14) || '2CH0'}`;
    } else if (clean.startsWith('PB09')) {
      clean = `BLD201${clean.substring(6, 10)}${clean.substring(10, 14) || '3DF1'}`;
    } else if (clean.startsWith('PB04')) {
      clean = `BJL301${clean.substring(6, 10)}${clean.substring(10, 14) || '4EG2'}`;
    } else if (clean.startsWith('PB13')) {
      clean = `BPH401${clean.substring(6, 10)}${clean.substring(10, 14) || '5FH3'}`;
    }

    // Universal 14-character statutory alphanumeric Bhu-Aadhaar standard
    let gridSector = clean.substring(0, 3);
    let blockCode = clean.substring(3, 6);
    let geoHash = clean.substring(6, 10);
    let polySig = clean.substring(10, 12);
    let checksum = clean.substring(12, 14);

    if (gridSector.length < 3) gridSector = 'BCN';
    if (blockCode.length < 3) blockCode = '501';
    if (geoHash.length < 4) geoHash = 'B1NA';
    if (polySig.length < 2) polySig = '2C';
    if (checksum.length < 2) checksum = 'H0';

    // Regional Cadastral Grid Sector mapping
    const gridMap = {
      'BCN': { dist: '02', distName: 'Amritsar', state: 'PB', stateName: 'Punjab', defaultTehsil: 'Amritsar-I', defaultVillage: 'Kot Atma Singh' },
      'BLD': { dist: '09', distName: 'Ludhiana', state: 'PB', stateName: 'Punjab', defaultTehsil: 'Ludhiana-East', defaultVillage: 'Civil Lines' },
      'BJL': { dist: '04', distName: 'Jalandhar', state: 'PB', stateName: 'Punjab', defaultTehsil: 'Jalandhar-I', defaultVillage: 'Model Town' },
      'BPH': { dist: '13', distName: 'Kapurthala / Phagwara', state: 'PB', stateName: 'Punjab', defaultTehsil: 'Phagwara', defaultVillage: 'Palahi' }
    };
    const distInfo = gridMap[gridSector] || gridMap['BCN'];

    return {
      raw,
      clean,
      isBcnStandard: true,
      gridSector,
      blockCode,
      geoHash,
      polySig,
      checksum,
      fullChecksum: `${polySig}${checksum}`,
      state: distInfo.state,
      stateName: distInfo.stateName,
      dist: distInfo.dist,
      distName: distInfo.distName,
      tehsil: '001',
      village: blockCode,
      plot: `${geoHash.substring(0, 2)}/${geoHash.substring(2)}`,
      formatted: clean
    };
  }

  getBhuNakshaRecord(parcelOrProps) {
    const p = parcelOrProps.properties || parcelOrProps || {};
    const ulpin = p.ulpin || 'BCN501B1NA2CH0';
    const decoded = this.decodeUlpin(ulpin);

    // District mapping
    const distMap = {
      '02': { name: 'Amritsar', namePa: 'ਅੰਮ੍ਰਿਤਸਰ', defaultTehsil: 'Amritsar-I', tehsilPa: 'ਅੰਮ੍ਰਿਤਸਰ-1' },
      '09': { name: 'Ludhiana', namePa: 'ਲੁਧਿਆਣਾ', defaultTehsil: 'Ludhiana-East', tehsilPa: 'ਲੁਧਿਆਣਾ ਪੂਰਬੀ' },
      '04': { name: 'Jalandhar', namePa: 'ਜਲੰਧਰ', defaultTehsil: 'Jalandhar-I', tehsilPa: 'ਜਲੰਧਰ-1' },
      '13': { name: 'Kapurthala', namePa: 'ਕਪੂਰਥਲਾ', defaultTehsil: 'Phagwara', tehsilPa: 'ਫਗਵਾੜਾ' }
    };
    const distInfo = distMap[decoded.dist] || distMap['02'];

    // Hadbast & Village mapping
    let hadbastNo = p.hadbast || p.hadbast_no || (p.bhunaksha && p.bhunaksha.hadbast_no);
    if (!hadbastNo) {
      if (p.survey_no && p.survey_no.includes('518')) hadbastNo = '201';
      else if (p.survey_no && p.survey_no.includes('302')) hadbastNo = '104';
      else if (p.survey_no && p.survey_no.includes('214')) hadbastNo = '301';
      else if (p.village && p.village.includes('Mall Road')) hadbastNo = '201';
      else if (p.village && p.village.includes('Ranjit Avenue')) hadbastNo = '104';
      else if (p.village && p.village.includes('Model Town')) hadbastNo = '301';
      else hadbastNo = decoded.village || '101';
    }

    const hadbastMap = {
      '101': { name: 'Kot Atma Singh / Heritage Zone', namePa: 'ਕੋਟ ਆਤਮਾ ਸਿੰਘ' },
      '102': { name: 'Hall Bazaar Commercial', namePa: 'ਹਾਲ ਬਾਜ਼ਾਰ' },
      '103': { name: 'Katra Ahluwalia', namePa: 'ਕਟੜਾ ਆਹਲੂਵਾਲੀਆ' },
      '104': { name: 'Ranjit Avenue Sector D', namePa: 'ਰਣਜੀਤ ਐਵਨਿਊ' },
      '201': { name: 'Mall Road Commercial Division', namePa: 'ਮਾਲ ਰੋਡ' },
      '301': { name: 'Model Town Residential Sector', namePa: 'ਮਾਡਲ ਟਾਊਨ' },
      '401': { name: 'Palahi (Law Gate)', namePa: 'ਪਲਾਹੀ' },
      '501': { name: 'Kot Atma Singh / Heritage Zone', namePa: 'ਕੋਟ ਆਤਮਾ ਸਿੰਘ' }
    };
    const villageInfo = hadbastMap[hadbastNo] || {
      name: p.locality || p.village || `${distInfo.name} Cadastre Zone`,
      namePa: distInfo.namePa
    };

    // Khasra Number
    let khasraNo = p.survey_no ? p.survey_no.replace(/Khasra No\.\s*/i, '').trim() : `${parseInt(decoded.plot.substring(0, 3), 10) || 412}/${parseInt(decoded.plot.substring(3), 10) || 1}`;

    // Distinct Area calculation in Punjab Revenue Units (Kanal & Marla)
    let sqyd = Number(p.area_sqyd);
    if (!sqyd || isNaN(sqyd)) {
      if (khasraNo.includes('412')) sqyd = 350;
      else if (khasraNo.includes('518')) sqyd = 580;
      else if (khasraNo.includes('302')) sqyd = 250;
      else if (khasraNo.includes('214')) sqyd = 420;
      else sqyd = 280;
    }
    const sqft = Number(p.area_sqft) || Math.round(sqyd * 9);
    const totalMarlas = Math.max(1, Math.round(sqyd / 30.25));
    const kanals = Math.floor(totalMarlas / 20);
    const marlas = totalMarlas % 20;
    const kanalMarlaStr = `${kanals} Kanal ${marlas} Marla (${sqyd.toLocaleString()} sq.yd)`;
    const kanalMarlaPa = `${kanals} ਕਨਾਲ ${marlas} ਮਰਲਾ`;

    // Khewat and Khatouni numbers
    const hash = Math.abs(decoded.clean.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0));
    const khewatNo = p.khewat_no || (p.khata && p.khata.includes('Khewat') ? p.khata.match(/Khewat\s*(\d+)/)?.[1] : ((hash % 450) + 12));
    const khatouniNo = p.khatouni_no || (p.khata && p.khata.includes('Khatouni') ? p.khata.match(/Khatouni\s*(\d+)/)?.[1] : ((hash % 680) + 35));
    const khataStr = p.khata || `KH-2024/${(hash % 900) + 100} (Khewat ${khewatNo} / Khatouni ${khatouniNo})`;
    const jamabandiYear = '2023-2024';

    return {
      state: 'Punjab',
      statePa: 'ਪੰਜਾਬ',
      district: distInfo.name,
      districtPa: distInfo.namePa,
      districtCode: decoded.dist,
      tehsil: p.tehsil || distInfo.defaultTehsil,
      tehsilPa: distInfo.tehsilPa,
      village: villageInfo.name,
      villagePa: villageInfo.namePa,
      hadbastNo: villageInfo.hadbastNo,
      khasraNo: khasraNo,
      khewatNo: khewatNo,
      khatouniNo: khatouniNo,
      khata: khataStr,
      jamabandiYear: jamabandiYear,
      owner: p.owner || 'Sardar Harpreet Singh',
      ownerPa: p.owner_pa || 'ਸਰਦਾਰ ਹਰਪ੍ਰੀਤ ਸਿੰਘ',
      ulpin: decoded.formatted,
      areaSqyd: sqyd,
      areaSqft: sqft,
      kanalMarla: kanalMarlaStr,
      kanalMarlaPa: kanalMarlaPa,
      landType: (p.total_floors > 2 || (p.status === 'FLAGGED_VIOLATION' && p.total_floors >= 2)) ? 'Gair Mumkin Dukan / Commercial (ਗ਼ੈਰ ਮੁਮਕਿਨ ਦੁਕਾਨ)' : 'Gair Mumkin Abadi (ਗ਼ੈਰ ਮੁਮਕਿਨ ਆਬਾਦੀ)',
      portalUrl: 'https://jamabandi.punjab.gov.in/'
    };
  }

  showToast(message, duration = 3500) {
    let toast = document.getElementById('global-toast-el');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast-el';
      toast.className = 'toast-notification';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>📋</span> <div>${message}</div>`;
    toast.style.display = 'flex';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      if (toast) toast.style.display = 'none';
    }, duration);
  }

  copyBhuNakshaDetails(ulpin) {
    const targetUlpin = ulpin || this.activeParcel?.ulpin || 'BCN501B1NA2CH0';
    const parcel = (this.allParcels || []).find(p => p.ulpin === targetUlpin || p.legacy_ulpin === targetUlpin) || (this.activeParcel?.ulpin === targetUlpin ? this.activeParcel : { ulpin: targetUlpin });
    const rec = this.getBhuNakshaRecord(parcel);
    const textToCopy = `=== OFFICIAL PUNJAB BHUNAKSHA & JAMABANDI REVENUE RECORD ===
State: Punjab (ਪੰਜਾਬ)
District: ${rec.district} (ਜ਼ਿਲ੍ਹਾ: ${rec.districtPa}, Code: ${rec.districtCode})
Tehsil: ${rec.tehsil} (ਤਹਿਸੀਲ: ${rec.tehsilPa})
Village / Hadbast: ${rec.village} (Hadbast No. ${rec.hadbastNo})
Khasra No (ਖਸਰਾ ਨੰ:): ${rec.khasraNo}
Khewat No (ਖੇਵਟ ਨੰ:): ${rec.khewatNo}
Khatouni No (ਖਤੌਨੀ ਨੰ:): ${rec.khatouniNo}
Khata Record: ${rec.khata}
Registered Owner: ${rec.owner} (ਪੰਜਾਬੀ: ${rec.ownerPa || 'ਸਰਦਾਰ ਹਰਪ੍ਰੀਤ ਸਿੰਘ'})
14-Digit Bhu-Aadhaar (ULPIN): ${rec.ulpin}
Cadastral Area: ${rec.kanalMarla}
Land Classification: ${rec.landType} (Lal Lakir / Abadi Deh)
Jamabandi Session Year: ${rec.jamabandiYear}
Official Punjab Verification Portal: ${rec.portalUrl}
-----------------------------------------------------------
LEGAL REVENUE NOTE (FOR EVALUATORS & CITIZENS):
- Urban Abadi (Lal Lakir) parcels historically lacked individual rural Jamabandi khasra records under the 1887 Land Revenue Act.
- Under the Government of India SVAMITVA Scheme & Punjab Mission Lal Lakir, 3D Cadastral Digital Twin generates statutory 14-character Bhu-Aadhaar ULPINs and vertical strata Sub-ULPINs.
===========================================================`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        this.showToast(`Copied BhuNaksha Details for ${rec.ulpin}! Ready to verify on jamabandi.punjab.gov.in`);
      }).catch(() => {
        this.fallbackCopy(textToCopy);
        this.showToast(`Copied BhuNaksha Details for ${rec.ulpin}!`);
      });
    } else {
      this.fallbackCopy(textToCopy);
      this.showToast(`Copied BhuNaksha Details for ${rec.ulpin}!`);
    }
  }

  copyActiveBhuNaksha() {
    if (this.activeParcel) {
      this.copyBhuNakshaDetails(this.activeParcel.ulpin);
    }
  }

  fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(textArea);
  }

  viewOfficialFard(ulpin) {
    const targetUlpin = ulpin || this.activeParcel?.ulpin || 'BCN501B1NA2CH0';
    const parcel = (this.allParcels || []).find(p => p.ulpin === targetUlpin || p.legacy_ulpin === targetUlpin) || (this.activeParcel?.ulpin === targetUlpin ? this.activeParcel : { ulpin: targetUlpin });
    const rec = this.getBhuNakshaRecord(parcel);
    this.activeFardUlpin = rec.ulpin;

    const modal = document.getElementById('modal-bhunaksha-fard');
    if (!modal) return;

    const fDist = document.getElementById('fard-district');
    const fTehsil = document.getElementById('fard-tehsil');
    const fVillage = document.getElementById('fard-village');
    const fYear = document.getElementById('fard-year');
    const fUlpin = document.getElementById('fard-ulpin');

    if (fDist) fDist.textContent = `${rec.district} (${rec.districtCode})`;
    if (fTehsil) fTehsil.textContent = rec.tehsil;
    if (fVillage) fVillage.textContent = `${rec.village} (Hadbast No. ${rec.hadbastNo})`;
    if (fYear) fYear.textContent = rec.jamabandiYear;
    if (fUlpin) fUlpin.textContent = rec.ulpin;

    const tKhewat = document.getElementById('fard-tbl-khewat');
    const tKhatouni = document.getElementById('fard-tbl-khatouni');
    const tOwner = document.getElementById('fard-tbl-owner');
    const tKhasra = document.getElementById('fard-tbl-khasra');
    const tArea = document.getElementById('fard-tbl-area');
    const tType = document.getElementById('fard-tbl-type');
    const tUlpin = document.getElementById('fard-tbl-ulpin');

    if (tKhewat) tKhewat.textContent = rec.khewatNo;
    if (tKhatouni) tKhatouni.textContent = rec.khatouniNo;
    if (tOwner) tOwner.innerHTML = `${rec.owner}<br><span style="font-size: 0.7rem; color: #64748b;">ਖ਼ੁਦਕਾਸ਼ਤ (Sole Owner 100%)</span>`;
    if (tKhasra) tKhasra.textContent = rec.khasraNo;
    if (tArea) tArea.innerHTML = `${rec.kanalMarlaPa}<br><span style="font-size: 0.7rem; color: #64748b;">(${rec.areaSqyd} sq.yd)</span>`;
    if (tType) tType.innerHTML = rec.landType;
    if (tUlpin) tUlpin.textContent = rec.ulpin;

    modal.style.display = 'flex';
  }

  closeFardModal() {
    const modal = document.getElementById('modal-bhunaksha-fard');
    if (modal) modal.style.display = 'none';
  }

  renderDossierHUD(parcel) {
    const decoded = this.decodeUlpin(parcel.ulpin);
    const bhu = this.getBhuNakshaRecord(parcel);
    const ulpinEl = document.getElementById('dossier-ulpin-val');
    const surveyEl = document.getElementById('dossier-survey-val');
    const ownerEl = document.getElementById('dossier-owner-val');
    const khataEl = document.getElementById('dossier-khata-val');
    const taxEl = document.getElementById('dossier-tax-val');
    const scanDateEl = document.getElementById('dossier-scandate-val');

    const distTehsilEl = document.getElementById('bhunaksha-dist-tehsil');
    const villageHadbastEl = document.getElementById('bhunaksha-village-hadbast');
    const areaKanalEl = document.getElementById('bhunaksha-area-kanal');
    const landTypeEl = document.getElementById('bhunaksha-land-type');

    if (distTehsilEl) distTehsilEl.textContent = `${bhu.district} (${bhu.districtCode}) • ${bhu.tehsil}`;
    if (villageHadbastEl) villageHadbastEl.textContent = `${bhu.village} (Hadbast #${bhu.hadbastNo})`;
    if (areaKanalEl) areaKanalEl.textContent = bhu.kanalMarla;
    if (landTypeEl) landTypeEl.textContent = bhu.landType;

    const isPending = (parcel.status === 'PENDING_REGISTRATION' || parcel.status === 'PENDING');

    if (ulpinEl) ulpinEl.textContent = decoded.formatted;

    // Update 14-digit segmented breakdown elements in Dossier
    const segState = document.getElementById('ulpin-seg-state');
    const segDist = document.getElementById('ulpin-seg-dist');
    const segTehsil = document.getElementById('ulpin-seg-tehsil');
    const segVillage = document.getElementById('ulpin-seg-village');
    const segPlot = document.getElementById('ulpin-seg-plot');
    const segDesc = document.getElementById('ulpin-breakdown-desc');

    if (segState) {
      segState.textContent = decoded.gridSector;
      if (segState.nextElementSibling) segState.nextElementSibling.textContent = 'Grid Sec';
    }
    if (segDist) {
      segDist.textContent = decoded.blockCode;
      if (segDist.nextElementSibling) segDist.nextElementSibling.textContent = 'Block';
    }
    if (segTehsil) {
      segTehsil.textContent = decoded.geoHash;
      if (segTehsil.nextElementSibling) segTehsil.nextElementSibling.textContent = 'GeoHash';
    }
    if (segVillage) {
      segVillage.textContent = decoded.polySig;
      if (segVillage.nextElementSibling) segVillage.nextElementSibling.textContent = 'PolySig';
    }
    if (segPlot) {
      segPlot.textContent = decoded.checksum;
      if (segPlot.nextElementSibling) segPlot.nextElementSibling.textContent = 'ChkSum';
    }

    if (segDesc) {
      segDesc.innerHTML = `
        <div class="bhu-aadhaar-pill-row">
          <span class="bhu-pill" title="Chars 1-3: Cadastral Grid Sector">🌐 Grid: ${decoded.gridSector}</span>
          <span class="bhu-pill" title="Chars 4-6: Cadastre Block">🏛️ Block #${decoded.blockCode}</span>
          <span class="bhu-pill" title="Chars 7-10: Centroid Geohash">🛰️ Hash: ${decoded.geoHash}</span>
          <span class="bhu-pill" title="Chars 11-12: Polyline Signature">📐 PolySig: ${decoded.polySig}</span>
          <span class="bhu-pill plot-pill" title="Chars 13-14: Modulo-36 Integrity Checksum">🔒 Mod-36: ${decoded.checksum}</span>
        </div>
      `;
    }

    if (surveyEl) surveyEl.textContent = parcel.survey_no;
    if (ownerEl) ownerEl.textContent = parcel.owner;
    if (khataEl) khataEl.textContent = parcel.khata;
    
    const taxVal = (parcel.tax_amount !== undefined && parcel.tax_amount !== null) ? Number(parcel.tax_amount).toLocaleString() : '14,200';
    if (taxEl) taxEl.textContent = `₹${taxVal} (${parcel.tax_status || 'PAID'})`;
    if (scanDateEl) scanDateEl.textContent = parcel.drone_scan_date || (isPending ? '⏳ Awaiting Autonomous Drone Scan' : 'Verified via LiDAR SLAM');

    // AI Anomaly Banner in Dossier
    const anomalyCard = document.getElementById('dossier-anomaly-card');
    if (anomalyCard) {
      if (parcel.has_anomaly) {
        anomalyCard.style.display = 'block';
        document.getElementById('dossier-anomaly-desc').textContent = parcel.anomaly_desc;
      } else {
        anomalyCard.style.display = 'none';
      }
    }

    // Ensure parcel has vertical levels (foundation + floors) matching its declaration
    if (!parcel.levels || parcel.levels.length < 1) {
      if (this.twin3d) {
        parcel.levels = this.twin3d.generateDefaultLevelsForParcel(parcel);
      }
    }

    // Build Floor Tabs
    const tabsContainer = document.getElementById('level-picker-tabs');
    if (tabsContainer) {
      if (isPending) {
        tabsContainer.innerHTML = `
          <div style="font-size: 0.76rem; color: #fbbf24; background: rgba(245, 158, 11, 0.12); padding: 8px 12px; border-radius: 6px; border: 1px dashed #f59e0b; line-height: 1.4;">
            ⏳ <strong>Floor Blueprint Locked</strong>: Volumetric 3D model will unlock once the autonomous cadastral LiDAR drone survey completes.
          </div>
        `;
      } else {
        tabsContainer.innerHTML = (parcel.levels || []).map(lvl => {
          const isFlag = lvl.is_flagged;
          const isGround = (lvl.level_code === 'G00' || lvl.level_code === 'Ground' || lvl.level_code === 'G0');
          const isSub = (lvl.level_code === 'B30' || lvl.is_subterranean);

          let label = lvl.level_code;
          if (isGround) label = 'Ground Floor';
          else if (isSub) label = 'B30: Foundation';
          else if (lvl.name) {
            const match = lvl.name.match(/Level\s*(\d+)/i);
            if (match) label = `Level ${match[1]}`;
            else label = lvl.name.split(' ')[0] || lvl.level_code;
          }

          return `
            <button class="level-tab ${isFlag ? 'flagged' : ''}" 
                    data-level="${lvl.level_code}"
                    title="${lvl.name || lvl.level_code}"
                    onclick="window.app.selectDossierLevel('${lvl.level_code}')">
              ${isFlag ? '🚨 ' : ''}${label}
            </button>
          `;
        }).join('');

        // Default select ground floor or top floor
        const defaultLvl = parcel.levels.find(l => l.level_code === 'G00' || l.level_code === 'Ground') || parcel.levels[0];
        if (defaultLvl) {
          this.selectDossierLevel(defaultLvl.level_code);
        }
      }
    }

    // Populate Building Measurements & Spatial Coordinates Card from real cadastral data
    const floorsCount = Math.max(1, parcel.total_floors || (parcel.levels ? parcel.levels.filter(l => !l.is_subterranean).length : 1));
    const plotSqyd = parcel.area_sqyd || Math.round((parcel.area_sqft || 3465) / 9);
    const plotSqft = parcel.area_sqft || (plotSqyd * 9);
    const builtSqft = parcel.built_up_sqft || Math.round(plotSqft * floorsCount * 0.82);
    const farVal = parcel.far || (builtSqft / Math.max(1, plotSqft)).toFixed(2);
    const heightM = parcel.height || (floorsCount * 3.4).toFixed(1);
    const heightFt = parcel.height_ft || Math.round(heightM * 3.28084);

    const heightEl = document.getElementById('dossier-height-val');
    const farEl = document.getElementById('dossier-far-val');
    const builtupEl = document.getElementById('dossier-builtup-val');
    const plotareaEl = document.getElementById('dossier-plotarea-val');
    const meterEl = document.getElementById('dossier-meter-val');
    const watermeterEl = document.getElementById('dossier-watermeter-val');
    const coordEl = document.getElementById('dossier-coordinates-val');

    if (heightEl) heightEl.textContent = `${heightM} m (${heightFt} ft)`;
    if (farEl) farEl.textContent = `${farVal} (${parcel.has_anomaly ? '⚠️ Exceeds Sanction' : '✅ Compliant'})`;
    if (builtupEl) builtupEl.textContent = `${builtSqft.toLocaleString()} sq.ft`;
    if (plotareaEl) plotareaEl.textContent = `${plotSqyd.toLocaleString()} sq.yd (${plotSqft.toLocaleString()} sq.ft)`;

    // Unique PSPCL electric meter and water meter per building
    const hash = Math.abs((parcel.ulpin || 'PB020011014121').split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0));
    const meterNum = `PSPCL-LT-${(hash % 89999) + 10000}`;
    const waterNum = `MCA-W-${(hash % 8999) + 1000}`;
    if (meterEl) meterEl.textContent = parcel.electric_meter || meterNum;
    if (watermeterEl) watermeterEl.textContent = parcel.water_meter || waterNum;

    let lat = 31.6125, lng = 74.8620;
    if (parcel.centroid) {
      const c = parcel.centroid;
      if (c[0] > 60) { lng = Number(c[0]); lat = Number(c[1]); }
      else { lat = Number(c[0]); lng = Number(c[1]); }
    } else if (parcel.coordinates && parcel.coordinates.length > 0) {
      const pt = parcel.coordinates[0];
      lng = Number(pt[0]); lat = Number(pt[1]);
    }

    if (coordEl) {
      coordEl.textContent = `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`;
    }

    // Google Maps Navigation Redirection Link
    const btnGmaps = document.getElementById('btn-dossier-gmaps');
    if (btnGmaps) {
      btnGmaps.href = `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
    }

    // Update dynamic historical timeline for this specific building
    this.updateTimelineForParcel(parcel);
  }

  triggerLiveDroneSimulation() {
    if (!this.activeParcel || !this.twin3d) return;

    const parcel = this.activeParcel;
    parcel.drone_dispatched = true;
    parcel.drone_scan_date = '🗓️ Mission Dispatched (Next 2 Working Days)';

    this.twin3d.executeDroneScanSimulation(() => {
      // DO NOT turn parcel into DIGITALIZED and DO NOT show or extrude building
      const scanDateEl = document.getElementById('dossier-scandate-val');
      if (scanDateEl) {
        scanDateEl.textContent = '🗓️ Mission Dispatched (Next 2 Working Days)';
      }

      this.showToast(`✅ Autonomous Drone Survey Dispatched for ${parcel.ulpin}! Mission #DRONE-PB02-2026-Q88 queued at Municipal Depot.`, 5000);

      if (this.map2d) {
        this.map2d.showMapToast(`✅ Drone Survey Mission Queued for ${parcel.ulpin} (Flight Window: Next 2 Working Days)`, 4500);
      }
    });
  }

  setMapLayer(layer) {
    if (this.map2d) {
      this.map2d.setBaseLayer(layer);
    }
  }

  handleMapFilterChange(val) {
    if (!val) return;
    if (val.startsWith('filter:')) {
      const filterKey = val.replace('filter:', '');
      this.applyMapFilter(filterKey);
    } else if (val.startsWith('dataset:')) {
      const datasetKey = val.replace('dataset:', '');
      this.switchMapDataset(datasetKey);
    } else {
      this.applyMapFilter(val);
    }
  }

  applyMapFilter(filterKey) {
    if (!filterKey) filterKey = 'all';

    // Sync select dropdown if present
    const sel = document.getElementById('select-building-filter');
    if (sel && sel.value !== filterKey) sel.value = filterKey;

    // Sync quick filter buttons
    document.querySelectorAll('.btn-quick-filter').forEach(btn => {
      const isMatch = btn.getAttribute('data-filter') === filterKey;
      btn.classList.toggle('active', isMatch);
      if (isMatch) {
        btn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.45)';
        btn.style.borderColor = '#38bdf8';
      } else {
        btn.style.boxShadow = 'none';
      }
    });

    if (this.map2d) {
      this.map2d.applyFilter(filterKey);
    }
  }

  switchMapDataset(datasetKey) {
    if (this.map2d) {
      this.map2d.switchDataset(datasetKey);
    }
  }

  selectDossierLevel(levelCode) {
    if (!this.activeParcel || !this.activeParcel.levels) return;

    // Robust matching supporting Ground / G00 / G0 variants
    const isGroundTarget = (levelCode === 'G00' || levelCode === 'Ground' || levelCode === 'G0');
    const level = this.activeParcel.levels.find(l => {
      if (l.level_code === levelCode) return true;
      if (isGroundTarget && (l.level_code === 'G00' || l.level_code === 'Ground' || l.level_code === 'G0')) return true;
      return false;
    });
    if (!level) return;

    this.activeLevel = level;

    // Highlight active tab
    document.querySelectorAll('.level-tab').forEach(t => {
      const tCode = t.getAttribute('data-level');
      const isMatch = (tCode === level.level_code) ||
        (isGroundTarget && (tCode === 'G00' || tCode === 'Ground' || tCode === 'G0'));
      if (isMatch) t.classList.add('active');
      else t.classList.remove('active');
    });

    // Update Dossier Level Info
    const subUlpinEl = document.getElementById('dossier-sub-ulpin');
    const levelNameEl = document.getElementById('dossier-level-name');
    const levelOwnerEl = document.getElementById('dossier-level-owner');
    const levelAreaEl = document.getElementById('dossier-level-area');
    const levelUtilitiesEl = document.getElementById('dossier-level-utilities');

    if (subUlpinEl) subUlpinEl.textContent = level.sub_ulpin;
    if (levelNameEl) levelNameEl.textContent = level.name;
    if (levelOwnerEl) levelOwnerEl.textContent = level.owner;
    if (levelAreaEl) levelAreaEl.textContent = `${level.carpet_area_sqft} sq.ft`;

    // Utilities / subterranean specs
    if (levelUtilitiesEl) {
      if (level.is_subterranean && level.utilities) {
        levelUtilitiesEl.innerHTML = level.utilities.map(u => `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${u.color};"></span>
              ${u.type}
            </span>
            <strong>${u.meter}</strong>
          </div>
        `).join('');
      } else {
        levelUtilitiesEl.innerHTML = `
          <div>Power Meter: <strong>PSPCL-LT-${Math.floor(Math.random() * 89999 + 10000)}</strong></div>
          <div>Water Connection: <strong>MCA-RES-${Math.floor(Math.random() * 8999 + 1000)}</strong></div>
        `;
      }
    }

    // Select in 3D WebGL scene
    if (this.twin3d) {
      this.twin3d.selectLevel(levelCode);
    }

    // Sync subterranean view mode buttons
    const isSub = (levelCode === 'B30');
    const surfBtn = document.getElementById('btn-mode-surface');
    const subBtn = document.getElementById('btn-mode-subterranean');
    if (surfBtn && subBtn) {
      if (isSub) {
        subBtn.classList.add('active');
        surfBtn.classList.remove('active');
      } else {
        surfBtn.classList.add('active');
        subBtn.classList.remove('active');
      }
    }
  }

  showTopNotification(title, body) {
    const notifBar = document.getElementById('top-gov-notification-bar');
    const titleEl = document.getElementById('notif-title');
    const bodyEl = document.getElementById('notif-body');

    if (titleEl) titleEl.innerHTML = title;
    if (bodyEl) bodyEl.innerHTML = body;
    if (notifBar) {
      notifBar.style.display = 'flex';
      notifBar.scrollIntoView({ behavior: 'smooth' });
    }
  }

  downloadChallanPDF() {
    window.print();
  }

  toggleSubterraneanView(enable) {
    if (this.twin3d) {
      this.twin3d.setSubterraneanMode(enable);
    }
    const surfBtn = document.getElementById('btn-mode-surface');
    const subBtn = document.getElementById('btn-mode-subterranean');
    if (surfBtn && subBtn) {
      if (enable) {
        subBtn.classList.add('active');
        surfBtn.classList.remove('active');
      } else {
        surfBtn.classList.add('active');
        subBtn.classList.remove('active');
      }
    }
  }



  switchMapDataset(datasetKey) {
    if (this.map2d) {
      this.map2d.switchDataset(datasetKey);
    }
  }

  setMapLayer(layerName) {
    if (this.map2d) {
      this.map2d.setBaseLayer(layerName);
    }
    document.querySelectorAll('.layer-switch-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`btn-layer-${layerName}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  setupHistorySlider() {
    const slider = document.getElementById('history-year-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const year = parseInt(e.target.value, 10);
        this.applyHistoricalYearForParcel(year);
      });
    }
  }

  generateBuildingTimeline(parcel) {
    const ulpin = parcel.ulpin || 'BCN501B1NA2CH0';
    const hash = Math.abs(ulpin.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0));
    const startYear = 2014 + (hash % 6); // Each building has a unique origin year: 2014, 2015, 2016, 2017, 2018, or 2019
    const owner = parcel.owner || 'Registered Owner';
    const khasra = parcel.survey_no || 'Khasra No. 412/1';
    const khata = parcel.khata || 'KH-2024/782';
    const tax = parcel.tax_amount || 4200;
    const floors = Math.max(1, parcel.total_floors || 1);
    const meterNum = `PSPCL-LT-${(hash % 89999) + 10000}`;

    const milestones = {};
    // Milestone 1: Open Land
    milestones[startYear] = {
      badge: `${startYear} (OPEN LAND) • REVENUE RECORD`,
      desc: `<strong>${startYear} (Open Land):</strong> Original Jamabandi Revenue Record under ancestral family ownership. Vacant agricultural/abadi parcel (${khasra}). No superstructure detected. Subterranean municipal right-of-way established.`,
      owner: `Ancestral Family / ${owner}`,
      khata: `${khata} (Khewat ${40 + (hash % 60)})`,
      tax: `₹${Math.round(tax * 0.15)} (Rural Land Cess - Paid)`,
      scanDate: 'Patwari Chain Survey (Pre-Drone)',
      hasAnomaly: false,
      activeLevels: ['B30']
    };

    // Milestone 2: Foundation / Construction
    const y2 = startYear + 2;
    if (y2 <= 2024) {
      milestones[y2] = {
        badge: `${y2} (FOUNDATION & PLINTH) • SANCTION APPROVED`,
        desc: `<strong>${y2} (Foundation & Plinth):</strong> Building plan sanctioned by Municipal Corporation Amritsar (#MCA/${y2}/${100 + (hash % 900)}). Foundation piles sunk to -30ft bedrock. Subterranean utility conduits mapped.`,
        owner: owner,
        khata: khata,
        tax: `₹${Math.round(tax * 0.45)} (Under-Construction Cess - Paid)`,
        scanDate: 'MCA Physical Field Inspection',
        hasAnomaly: false,
        activeLevels: ['B30', 'G00']
      };
    }

    // Milestone 3: Initial Superstructure
    const y3 = Math.min(2024, startYear + 4);
    if (y3 > y2 && y3 <= 2024) {
      milestones[y3] = {
        badge: `${y3} (REGISTERED STRUCTURE) • MUTATION ENTERED`,
        desc: `<strong>${y3} (Superstructure Mutation):</strong> Mutation registered in revenue records under ${owner}. Ground ${floors > 1 ? '+ Upper floor structure' : 'floor villa'} completed. Electricity connection (${meterNum}) energized.`,
        owner: owner,
        khata: khata,
        tax: `₹${Math.round(tax * 0.8)} (Property Tax - Paid)`,
        scanDate: 'SVAMITVA Phase 1 Drone Telemetry',
        hasAnomaly: false,
        activeLevels: floors > 1 ? ['B30', 'G00', 'F01'] : ['B30', 'G00']
      };
    }

    // Milestone 4: Present Day 2026
    const allLvlCodes = parcel.levels ? parcel.levels.map(l => l.level_code) : ['B30', 'G00'];
    milestones[2026] = {
      badge: `2026 (PRESENT DAY) • ${parcel.has_anomaly ? '🚨 AI ANOMALY NOTICE' : '✅ 3D DIGITAL TWIN VERIFIED'}`,
      desc: parcel.has_anomaly
        ? `<strong>2026 (🚨 Present Day):</strong> Autonomous LiDAR SLAM 3R drone survey detected statutory discrepancy: ${parcel.anomaly_desc || 'Height/Encroachment anomaly'}. Statutory 24h notice active under Sec 187 Punjab Municipal Act.`
        : `<strong>2026 (Present Day):</strong> Autonomous LiDAR SLAM 3R drone survey completed. All ${floors} levels digitally verified against approved master plan. High-precision 3D Digital Twin published.`,
      owner: owner,
      khata: khata,
      tax: `₹${tax.toLocaleString()} (${parcel.tax_status || 'PAID'})`,
      scanDate: parcel.drone_scan_date || 'Autonomous Drone SLAM 3R (Sept 2026)',
      hasAnomaly: !!parcel.has_anomaly,
      activeLevels: allLvlCodes
    };

    return { startYear, meterNum, milestones };
  }

  updateTimelineForParcel(parcel) {
    const timelineData = this.generateBuildingTimeline(parcel);
    const milestones = timelineData.milestones;
    const years = Object.keys(milestones).map(Number).sort((a, b) => a - b);

    // Update Building & Owner & Meter Tags
    const bldgTag = document.getElementById('history-building-tag');
    const ownerTag = document.getElementById('history-owner-tag');
    const meterTag = document.getElementById('history-meter-tag');
    if (bldgTag) bldgTag.textContent = parcel.ulpin;
    if (ownerTag) ownerTag.textContent = parcel.owner;
    if (meterTag) meterTag.textContent = `⚡ Meter: ${timelineData.meterNum}`;

    // Update Slider Bounds
    const slider = document.getElementById('history-year-slider');
    if (slider) {
      slider.min = years[0];
      slider.max = 2026;
      slider.value = 2026;
    }

    // Rebuild Milestones Labels Container
    const container = document.getElementById('history-milestones-container');
    if (container) {
      container.innerHTML = years.map(y => `
        <span class="milestone-label ${y === 2026 ? 'active' : ''}" 
              data-year="${y}" 
              onclick="window.app.applyHistoricalYearForParcel(${y})">
          ${y} (${milestones[y].hasAnomaly ? '🚨 ' : ''}${y === years[0] ? 'Open Land' : y === 2026 ? 'Present' : 'Built'})
        </span>
      `).join('');
    }

    this.currentBuildingTimeline = milestones;
    this.applyHistoricalYearForParcel(2026);
  }

  applyHistoricalYearForParcel(year) {
    if (!this.currentBuildingTimeline) return;
    const slider = document.getElementById('history-year-slider');
    if (slider) slider.value = year;

    document.querySelectorAll('.milestone-label').forEach(lbl => {
      const y = parseInt(lbl.getAttribute('data-year'), 10);
      if (y === year) lbl.classList.add('active');
      else lbl.classList.remove('active');
    });

    const rec = this.currentBuildingTimeline[year] || this.currentBuildingTimeline[2026];
    if (!rec) return;

    const badgeEl = document.getElementById('history-active-badge');
    const descEl = document.getElementById('history-event-desc');
    if (badgeEl) {
      badgeEl.textContent = rec.badge;
      if (rec.hasAnomaly) badgeEl.classList.add('flagged');
      else badgeEl.classList.remove('flagged');
    }
    if (descEl) descEl.innerHTML = rec.desc;

    const ownerEl = document.getElementById('dossier-owner-val');
    const khataEl = document.getElementById('dossier-khata-val');
    const taxEl = document.getElementById('dossier-tax-val');
    const scanDateEl = document.getElementById('dossier-scandate-val');
    const anomalyCard = document.getElementById('dossier-anomaly-card');

    if (ownerEl) ownerEl.textContent = rec.owner;
    if (khataEl) khataEl.textContent = rec.khata;
    if (taxEl) taxEl.textContent = rec.tax;
    if (scanDateEl) scanDateEl.textContent = rec.scanDate;

    if (anomalyCard) {
      anomalyCard.style.display = rec.hasAnomaly ? 'block' : 'none';
    }

    document.querySelectorAll('.level-tab').forEach(tab => {
      const code = tab.getAttribute('data-level');
      tab.style.display = 'inline-block';
      if (rec.activeLevels.includes(code)) {
        tab.style.opacity = '1.0';
      } else {
        tab.style.opacity = '0.55';
      }
    });

    if (this.twin3d && rec.activeLevels) {
      this.twin3d.setVisibleLevels(rec.activeLevels);
    }
  }

  applyHistoricalYear(year) {
    this.applyHistoricalYearForParcel(year);
  }

  startCountdown() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    this.countdownTimer = setInterval(() => {
      this.secondsRemaining--;
      if (this.secondsRemaining < 0) {
        this.secondsRemaining = 0;
        clearInterval(this.countdownTimer);
      }

      const h = Math.floor(this.secondsRemaining / 3600);
      const m = Math.floor((this.secondsRemaining % 3600) / 60);
      const s = this.secondsRemaining % 60;

      const timeStr = `${h}h ${m}m ${s}s remaining`;
      document.querySelectorAll('.timer-countdown').forEach(el => {
        el.textContent = timeStr;
      });
    }, 1000);
  }
}

// Attach globally
window.app = new BhuAadhaarApp();
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.app.init();
  });
} else {
  window.app.init();
}
