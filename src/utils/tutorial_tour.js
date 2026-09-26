// 🏛️ BHAVANINFO 3D Cadastral Digital Twin Portal - 5-Step Interactive Tutorial & Quick Tips Guide
// Provides comprehensive onboarding for new users explaining what to do, when to do it, and navigation shortcuts.

export class TutorialTourGuide {
  constructor(appInstance) {
    this.app = appInstance;
    this.currentStep = 0;
    this.isTourActive = false;
    this.storageKeySeen = 'bhavaninfo_tutorial_seen';
    this.storageKeySkipTips = 'bhavaninfo_skip_tips_startup';

    this.steps = [
      {
        number: 1,
        title: "Switch Between Digital Twin Modes",
        targetSelector: ".nav-links",
        badgeText: "Step 1 of 5 • Global Views",
        icon: "🏛️",
        whatToDo: "Use these top navigation tabs to toggle between your personal land deeds ('My Portfolio'), the city-wide '3D Satellite City Map', and the level-by-level '3D Digital Twin Inspector'.",
        whenToDoIt: "When to use: Switch to '3D Satellite City Map' whenever you want an aerial bird's-eye view of Punjab, or '3D Digital Twin Inspector' to inspect floor-by-floor structural heights.",
        proTip: "💡 Pro Tip: Your active property selection remains preserved when you switch between views.",
        preferredPlacement: "bottom"
      },
      {
        number: 2,
        title: "Instant City Fly-To Navigation",
        targetSelector: "#tour-step-flyto",
        badgeText: "Step 2 of 5 • City Navigation",
        icon: "📍",
        whatToDo: "Click any city button (Amritsar, Ludhiana 3,000+, Phagwara 1,200+, Jalandhar 2,500+, Patiala, Mohali) to instantly fly to dense 3D urban cadastral zones.",
        whenToDoIt: "When to use: When surveying properties in a specific municipal division or verifying district-level master plans.",
        proTip: "💡 Pro Tip: Ludhiana and Jalandhar contain over 5,500 real building footprints with millimeter-accurate coordinates.",
        preferredPlacement: "bottom"
      },
      {
        number: 3,
        title: "Filter Properties & Audit AI Violations",
        targetSelector: "#tour-step-filters",
        badgeText: "Step 3 of 5 • AI Audits",
        icon: "🎯",
        whatToDo: "Use the filter dropdown or quick chips to filter by Digitalized 3D Twins, AI Height/Setback Violations under 24h statutory notice, or Pending drone surveys.",
        whenToDoIt: "When to use: Select '🚨 Violations' to audit illegal vertical storeys exceeding municipal limits or setback encroachments on public roads.",
        proTip: "💡 Pro Tip: Red buildings indicate AI-flagged unauthorized construction with active statutory notices.",
        preferredPlacement: "bottom"
      },
      {
        number: 4,
        title: "Universal Cadastre & 14-Digit ULPIN Search",
        targetSelector: "#tour-nav-search",
        badgeText: "Step 4 of 5 • Search Engine",
        icon: "🔍",
        whatToDo: "Search by 14-digit Bhu-Aadhaar ULPIN (e.g. PB-ASR-2026-0001), owner name, landmark, city, or GPS coordinates to spotlight any property.",
        whenToDoIt: "When to use: Whenever you have a specific registry deed, mutation token, property tax bill, or survey reference.",
        proTip: "💡 Pro Tip: Press Ctrl + K from anywhere on the portal to instantly jump focus to the search bar.",
        preferredPlacement: "bottom"
      },
      {
        number: 5,
        title: "3D Building Inspection & Citizen Services",
        targetSelector: "#tour-step-actions",
        badgeText: "Step 5 of 5 • 3D Twins & Services",
        icon: "🏢",
        whatToDo: "Click directly on any 3D building footprint on the map to inspect its real 3D mesh, view smart meter telemetry, verify tax status, and download official certified government NOCs. Click '+ Survey Building' to register a new property.",
        whenToDoIt: "When to use: When evaluating property values, conducting due diligence for property purchase, or scheduling drone surveys.",
        proTip: "💡 Pro Tip: Hold Right-Click & Drag on the 3D map to tilt the camera for realistic aerial drone perspective!",
        preferredPlacement: "bottom"
      }
    ];

    this.bindKeyboardShortcuts();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initDomListeners());
    } else {
      this.initDomListeners();
    }
  }

  // Bind direct click listeners to all buttons
  initDomListeners() {
    const closeBtn = document.getElementById('btn-close-onboarding-top');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeQuickTipsModal();
      };
    }

    const skipBtn = document.getElementById('btn-onboarding-skip');
    if (skipBtn) {
      skipBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chk = document.getElementById('chk-dont-show-tips');
        this.closeQuickTipsModal(chk ? chk.checked : true);
        this.skipTour();
      };
    }

    const startBtn = document.getElementById('btn-onboarding-start');
    if (startBtn) {
      startBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const chk = document.getElementById('chk-dont-show-tips');
        if (chk && chk.checked) {
          try { localStorage.setItem(this.storageKeySkipTips, 'true'); } catch (err) {}
        }
        this.startGuidedTour();
      };
    }

    const modal = document.getElementById('onboarding-tips-modal');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          this.closeQuickTipsModal();
        }
      };
    }

    const tourPrevBtn = document.getElementById('tour-btn-prev');
    if (tourPrevBtn) {
      tourPrevBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.prevTourStep();
      };
    }

    const tourNextBtn = document.getElementById('tour-btn-next');
    if (tourNextBtn) {
      tourNextBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.nextTourStep();
      };
    }

    const tourSkipBtn = document.getElementById('tour-btn-skip-bottom');
    if (tourSkipBtn) {
      tourSkipBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.skipTour();
      };
    }

    const tourCloseBtn = document.getElementById('tour-card-close-btn');
    if (tourCloseBtn) {
      tourCloseBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.skipTour();
      };
    }
  }

  // Check if first-time user needs to see onboarding tips
  checkAutoPrompt() {
    try {
      const skipTips = localStorage.getItem(this.storageKeySkipTips);
      const seen = localStorage.getItem(this.storageKeySeen);
      if (!seen && skipTips !== 'true') {
        setTimeout(() => {
          this.showQuickTipsModal();
        }, 1200);
      }
    } catch (e) {
      console.warn('LocalStorage not accessible for tutorial state:', e);
    }
  }

  // Display Quick Start Tips Modal
  showQuickTipsModal() {
    const modal = document.getElementById('onboarding-tips-modal');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
      this.initDomListeners();
    }
  }

  // Close Quick Start Tips Modal
  closeQuickTipsModal(dontShowAgain = false) {
    const modal = document.getElementById('onboarding-tips-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    if (dontShowAgain) {
      try {
        localStorage.setItem(this.storageKeySkipTips, 'true');
      } catch (e) {}
    }
  }

  // Start the 5-Step Guided Spotlight Tour
  startGuidedTour() {
    this.closeQuickTipsModal();
    this.isTourActive = true;
    this.currentStep = 0;

    // Ensure user is on 3D City Map view where all tour targets exist
    if (this.app && typeof this.app.switchView === 'function') {
      this.app.switchView('map');
    }

    const overlay = document.getElementById('interactive-tour-overlay');
    if (overlay) {
      overlay.classList.add('active');
      overlay.style.display = 'block';
    }

    setTimeout(() => {
      this.renderTourStep(this.currentStep);
    }, 250);
  }

  // Render a specific step of the tour
  renderTourStep(index) {
    if (index < 0 || index >= this.steps.length) {
      this.finishTour();
      return;
    }

    this.currentStep = index;
    const step = this.steps[index];

    // Find target element
    let targetEl = document.querySelector(step.targetSelector);
    if (!targetEl && step.fallbackSelector) {
      targetEl = document.querySelector(step.fallbackSelector);
    }

    // Update Spotlight box
    const spotlight = document.getElementById('tour-spotlight-box');
    const tourCard = document.getElementById('interactive-tour-card');

    if (spotlight && targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const pad = 6;
      spotlight.style.top = `${Math.max(0, rect.top - pad + window.scrollY)}px`;
      spotlight.style.left = `${Math.max(0, rect.left - pad + window.scrollX)}px`;
      spotlight.style.width = `${rect.width + pad * 2}px`;
      spotlight.style.height = `${rect.height + pad * 2}px`;
      spotlight.style.display = 'block';
      spotlight.classList.add('pulse-glow');
    } else if (spotlight) {
      spotlight.style.display = 'none';
    }

    // Populate card content
    const titleEl = document.getElementById('tour-card-title');
    const badgeEl = document.getElementById('tour-card-badge');
    const whatToDoEl = document.getElementById('tour-card-what');
    const whenToDoEl = document.getElementById('tour-card-when');
    const tipEl = document.getElementById('tour-card-tip');
    const prevBtn = document.getElementById('tour-btn-prev');
    const nextBtn = document.getElementById('tour-btn-next');
    const dotsContainer = document.getElementById('tour-step-dots');

    if (titleEl) titleEl.innerHTML = `${step.icon} ${step.title}`;
    if (badgeEl) badgeEl.textContent = step.badgeText;
    if (whatToDoEl) whatToDoEl.innerHTML = `<strong>What to do:</strong> ${step.whatToDo}`;
    if (whenToDoEl) whenToDoEl.innerHTML = `<strong>When to do it:</strong> ${step.whenToDoIt}`;
    if (tipEl) tipEl.innerHTML = step.proTip;

    if (prevBtn) {
      prevBtn.style.display = index === 0 ? 'none' : 'inline-flex';
      prevBtn.disabled = index === 0;
      prevBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.prevTourStep();
      };
    }

    if (nextBtn) {
      if (index === this.steps.length - 1) {
        nextBtn.innerHTML = 'Finish &amp; Explore 🚀';
        nextBtn.classList.add('finish-state');
      } else {
        nextBtn.innerHTML = 'Next Step &rarr;';
        nextBtn.classList.remove('finish-state');
      }
      nextBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.nextTourStep();
      };
    }

    const tourSkipBtn = document.getElementById('tour-btn-skip-bottom');
    if (tourSkipBtn) {
      tourSkipBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.skipTour();
      };
    }

    const tourCloseBtn = document.getElementById('tour-card-close-btn');
    if (tourCloseBtn) {
      tourCloseBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.skipTour();
      };
    }

    // Render step dots
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      this.steps.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = `tour-dot ${i === index ? 'active' : ''} ${i < index ? 'completed' : ''}`;
        dot.onclick = () => this.renderTourStep(i);
        dotsContainer.appendChild(dot);
      });
    }

    // Position the tour card relative to target
    if (tourCard) {
      tourCard.style.display = 'block';
      this.positionCardRelativeToTarget(tourCard, targetEl);
    }
  }

  // Calculate smart card placement avoiding screen edges
  positionCardRelativeToTarget(card, targetEl) {
    const cardWidth = 440;
    const cardHeight = 310;
    const margin = 14;

    if (!targetEl) {
      // Center card
      card.style.top = '50%';
      card.style.left = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    card.style.transform = 'none';
    const rect = targetEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left + (rect.width / 2) - (cardWidth / 2);
    // Keep horizontally within viewport bounds
    left = Math.max(margin, Math.min(left, viewportWidth - cardWidth - margin));

    let top = rect.bottom + margin;
    // If not enough room below, position above
    if (top + cardHeight > viewportHeight - margin) {
      top = Math.max(margin, rect.top - cardHeight - margin);
    }

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  // Move to next step
  nextTourStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.renderTourStep(this.currentStep + 1);
    } else {
      this.finishTour();
    }
  }

  // Move to previous step
  prevTourStep() {
    if (this.currentStep > 0) {
      this.renderTourStep(this.currentStep - 1);
    }
  }

  // Skip tutorial completely
  skipTour() {
    this.closeTour();
    try {
      localStorage.setItem(this.storageKeySeen, 'true');
    } catch (e) {}
  }

  // Finish tutorial on last step
  finishTour() {
    this.closeTour();
    try {
      localStorage.setItem(this.storageKeySeen, 'true');
    } catch (e) {}

    // Show brief toast
    if (this.app && typeof this.app.showToast === 'function') {
      this.app.showToast('🎉 Tutorial completed! You can relaunch it anytime via "✨ 5-Step Tour" in the top bar.', 4500);
    }
  }

  // Close tour overlay
  closeTour() {
    this.isTourActive = false;
    const overlay = document.getElementById('interactive-tour-overlay');
    const card = document.getElementById('interactive-tour-card');
    const spotlight = document.getElementById('tour-spotlight-box');

    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
    if (card) card.style.display = 'none';
    if (spotlight) spotlight.style.display = 'none';
  }

  // Keyboard navigation
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+K for global search focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-cadastre-search');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // If tour is active, handle keyboard navigation
      if (this.isTourActive) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.skipTour();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          this.nextTourStep();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.prevTourStep();
        }
      }
    });

    // Reposition tour card on window resize
    window.addEventListener('resize', () => {
      if (this.isTourActive) {
        this.renderTourStep(this.currentStep);
      }
    });
  }
}
