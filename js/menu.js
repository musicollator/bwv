// =============================================================================
// BWV NAVIGATION MENU SYSTEM - Dynamic Loading Version (No Page Reload)
// =============================================================================

class BWVNavigationMenu {
  constructor() {
    this.availableWorks = ['bwv1006']; // Fallback default
    this.currentWorkId = null;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.minSwipeDistance = 50;
    this.isLoaded = false;
    this.isNavigating = false; // Prevent multiple simultaneous navigations

    this.isSwipeActive = false;
    this.swipeArrows = { left: null, right: null };
  }

  async init() {
    this.updateCurrentWork();
    await this.loadAvailableWorks();
    this.createNavigationButtons();
    this.updateActiveState();
    this.attachEventListeners();

    // Set up browser back/forward handling
    this.setupHistoryHandling();
  }

  async loadAvailableWorks() {
    try {
      const response = await fetch('bwvs.json');

      if (!response.ok) {
        throw new Error(`Failed to load bwvs.json: ${response.status}`);
      }

      const bwvsData = await response.json();

      if (bwvsData.bwvs && Array.isArray(bwvsData.bwvs) && bwvsData.bwvs.length > 0) {
        // Numerical sorting by BWV number
        this.availableWorks = bwvsData.bwvs.sort((a, b) => {
          // Extract numeric part (remove 'bwv' prefix)
          const numA = parseInt(a.replace(/^bwv/, ''), 10);
          const numB = parseInt(b.replace(/^bwv/, ''), 10);
          return numA - numB;
        });
      } else {
        throw new Error('Invalid bwvs.json format or empty BWV list');
      }

      this.isLoaded = true;

    } catch (error) {
      console.warn('⚠️ Failed to load BWV list from bwvs.json:', error.message);
      this.showLoadingError('Failed to load BWV navigation. Using fallback.');
      this.isLoaded = false;
    }
  }

  createNavigationButtons() {
    const container = document.getElementById('bwv-buttons-container');
    const loadingDiv = document.getElementById('bwv-navigation-loading');

    if (!container) {
      console.error('❌ BWV buttons container not found');
      return;
    }

    // Clear loading message
    if (loadingDiv) {
      loadingDiv.remove();
    }

    // Clear any existing buttons
    container.innerHTML = '';

    // Create buttons for each available work
    this.availableWorks.forEach(workId => {
      const button = document.createElement('button');
      button.className = 'btn btn-sm btn-outline-light rounded-0';
      button.type = 'button';
      button.setAttribute('data-work-id', workId);

      // Format display text (BWV 1006 from bwv1006)
      const displayText = workId.replace(/^bwv/, 'BWV ').toUpperCase();
      button.textContent = displayText;

      container.appendChild(button);
    });

    // Force a reflow to ensure buttons are rendered
    container.offsetWidth;
  }

  showLoadingError(message) {
    const loadingDiv = document.getElementById('bwv-navigation-loading');
    if (loadingDiv) {
      loadingDiv.className = 'text-warning small';
      loadingDiv.textContent = message;
    }
  }

  updateCurrentWork(workId = null) {
    if (workId) {
      // Direct assignment for dynamic loading
      this.currentWorkId = workId;
    } else {
      // Get current work from URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const werkParam = urlParams.get('werk');

      if (werkParam) {
        this.currentWorkId = werkParam.match(/^\d+$/) ? `bwv${werkParam}` : werkParam;
      } else {
        this.currentWorkId = 'bwv1006'; // Default
      }
    }
  }

  updateActiveState() {
    // Remove active styling and re-enable all buttons, restore original content
    document.querySelectorAll('[data-work-id]').forEach(btn => {
      btn.classList.remove('btn-warning', 'btn-secondary', 'btn-active');
      btn.classList.add('btn-outline-light');
      btn.disabled = false;

      // Restore original BWV text
      const workId = btn.dataset.workId;
      if (workId) {
        const number = workId.replace('bwv', '');
        btn.textContent = `BWV ${number}`;
      }
    });

    // Find and enhance the current work button
    const activeBtn = document.querySelector(`[data-work-id="${this.currentWorkId}"]`);
    if (activeBtn) {
      // Style as current with Bach gold background and border
      activeBtn.classList.remove('btn-outline-light');
      activeBtn.classList.add('btn-active');

      // Get the BWV number for display
      const number = this.currentWorkId.replace('bwv', '');

      // Create enhanced content with integrated Wikipedia element
      activeBtn.innerHTML = `
        <span>BWV ${number}</span>
        <span class="wiki-element" 
              title="Open Wikipedia in new tab">
          <img src="media/Wikipedia-logo-v2.svg" width="24" height="24" alt="Wikipedia">
        </span>
      `;

      // Add click handler specifically to the Wikipedia element
      const wikiElement = activeBtn.querySelector('.wiki-element');
      if (wikiElement) {
        wikiElement.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (window.CONFIG?.workInfo?.externalURL) {
            window.open(window.CONFIG.workInfo.externalURL, '_blank', 'noopener,noreferrer');
          } else {
            console.warn('🔗 No Wikipedia URL found in CONFIG');
          }
        });

        // Add hover effect
        wikiElement.addEventListener('mouseenter', () => {
          wikiElement.classList.add('wiki-element-hover');
        });

        wikiElement.addEventListener('mouseleave', () => {
          wikiElement.classList.remove('wiki-element-hover');
        });
      }
    }
    this.scrollActiveIntoView();
  }

  scrollActiveIntoView() {
    const activeBtn = document.querySelector(`[data-work-id="${this.currentWorkId}"]`);
    const container = document.getElementById('bwv-buttons-container');

    if (activeBtn && container?.classList.contains('scrolling')) {
      setTimeout(() => {
        activeBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }, 100);
    }
  }

  createSwipeArrows() {
    this.isSwipeActive = true;

    // Create left arrow
    if (!this.swipeArrows.left) {
      this.swipeArrows.left = document.createElement('div');
      this.swipeArrows.left.innerHTML = '‹';
      this.swipeArrows.left.className = 'swipe-arrow swipe-arrow-left';
      document.body.appendChild(this.swipeArrows.left);
    }

    // Create right arrow
    if (!this.swipeArrows.right) {
      this.swipeArrows.right = document.createElement('div');
      this.swipeArrows.right.innerHTML = '›';
      this.swipeArrows.right.className = 'swipe-arrow swipe-arrow-right';
      document.body.appendChild(this.swipeArrows.right);
    }
  }

  updateSwipeArrows(currentX) {
    const swipeDistance = currentX - this.touchStartX;
    const threshold = 20; // Minimum movement to show arrows

    if (Math.abs(swipeDistance) < threshold) {
      // Hide both arrows if movement is too small
      this.swipeArrows.left.classList.remove('swipe-arrow-visible');
      this.swipeArrows.right.classList.remove('swipe-arrow-visible');
      return;
    }

    if (swipeDistance > 0) {
      // Swiping right (previous) - only show if we can go previous
      if (this.canNavigatePrevious()) {
        this.swipeArrows.left.classList.add('swipe-arrow-visible');
      } else {
        this.swipeArrows.left.classList.remove('swipe-arrow-visible');
      }
      this.swipeArrows.right.classList.remove('swipe-arrow-visible');
    } else {
      // Swiping left (next) - only show if we can go next
      if (this.canNavigateNext()) {
        this.swipeArrows.right.classList.add('swipe-arrow-visible');
      } else {
        this.swipeArrows.right.classList.remove('swipe-arrow-visible');
      }
      this.swipeArrows.left.classList.remove('swipe-arrow-visible');
    }
  }

  hideSwipeArrows() {
    this.isSwipeActive = false;

    if (this.swipeArrows.left) {
      this.swipeArrows.left.classList.remove('swipe-arrow-visible');
    }
    if (this.swipeArrows.right) {
      this.swipeArrows.right.classList.remove('swipe-arrow-visible');
    }
  }

  // NEW: Helper methods to check navigation bounds
  canNavigatePrevious() {
    const currentIndex = this.getCurrentWorkIndex();
    return currentIndex > 0;
  }

  canNavigateNext() {
    const currentIndex = this.getCurrentWorkIndex();
    return currentIndex < this.availableWorks.length - 1;
  }

  // Enhanced handleSwipeGesture with bounds checking
  handleSwipeGesture() {
    const swipeDistance = this.touchEndX - this.touchStartX;

    if (Math.abs(swipeDistance) < this.minSwipeDistance) {
      return;
    }

    if (swipeDistance > 0) {
      // Swiping right (previous) - only navigate if possible
      if (this.canNavigatePrevious()) {
        this.navigateToPrevious();
      }
    } else {
      // Swiping left (next) - only navigate if possible
      if (this.canNavigateNext()) {
        this.navigateToNext();
      }
    }
  }

  attachEventListeners() {
    // Click events for navigation buttons
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-work-id]');
      if (navBtn) {
        const workId = navBtn.dataset.workId;
        if (workId !== this.currentWorkId) {
          this.navigateToWork(workId);
        }
      }
    });

    // Target swipe gestures only to the SVG container
    const swipeTarget = document.getElementById('svg-container');
    if (swipeTarget) {
      swipeTarget.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
        this.createSwipeArrows();
      }, { passive: true });

      swipeTarget.addEventListener('touchmove', (e) => {
        if (this.isSwipeActive) {
          const currentX = e.changedTouches[0].screenX;
          this.updateSwipeArrows(currentX);
        }
      }, { passive: true });

      swipeTarget.addEventListener('touchend', (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.hideSwipeArrows();
        this.handleSwipeGesture();
      }, { passive: true });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.navigateToPrevious();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.navigateToNext();
        }
      }
    });
  }

  setupHistoryHandling() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.workId) {
        this.loadWorkDynamically(e.state.workId, false); // false = don't push to history
      } else {
        // Fallback to reading from URL
        const urlParams = new URLSearchParams(window.location.search);
        const werkParam = urlParams.get('werk');
        const workId = werkParam ? (werkParam.match(/^\d+$/) ? `bwv${werkParam}` : werkParam) : 'bwv1006';
        this.loadWorkDynamically(workId, false);
      }
    });
  }

  handleSwipeGesture() {
    const swipeDistance = this.touchEndX - this.touchStartX;

    if (Math.abs(swipeDistance) < this.minSwipeDistance) {
      return;
    }

    if (swipeDistance > 0) {
      this.navigateToPrevious();
    } else {
      this.navigateToNext();
    }
  }

  getCurrentWorkIndex() {
    return this.availableWorks.findIndex(work => work === this.currentWorkId);
  }

  navigateToPrevious() {
    const currentIndex = this.getCurrentWorkIndex();
    if (currentIndex > 0) {
      const previousWork = this.availableWorks[currentIndex - 1];
      this.navigateToWork(previousWork);
    }
  }

  navigateToNext() {
    const currentIndex = this.getCurrentWorkIndex();
    if (currentIndex < this.availableWorks.length - 1) {
      const nextWork = this.availableWorks[currentIndex + 1];
      this.navigateToWork(nextWork);
    }
  }

  // =============================================================================
  // DYNAMIC NAVIGATION - NO PAGE RELOAD
  // =============================================================================

  async navigateToWork(workId) {
    if (this.isNavigating) {
      console.log('⏳ Navigation already in progress, ignoring...');
      return;
    }

    console.log(`🔄 Dynamically loading ${workId}...`);
    await this.loadWorkDynamically(workId, true);
  }

  async loadWorkDynamically(workId, pushToHistory = true) {
    if (this.isNavigating) return;

    this.isNavigating = true;

    try {
      // Show loading state on navigation buttons
      this.showNavigationLoading();

      // Update current work ID and navigation state
      const previousWorkId = this.currentWorkId;
      this.updateCurrentWork(workId);

      // Update URL without page reload
      if (pushToHistory) {
        const url = new URL(window.location);
        url.searchParams.set('werk', workId.replace('bwv', ''));

        // Push to browser history with state
        const title = `BWV ${workId.replace('bwv', '')} - Bach Werke Verzeichnis`;
        history.pushState(
          { workId: workId },
          title,
          url.toString()
        );
      }

      // Load the new work's content using index.js function
      await this.loadWorkContent(workId);

      // Update navigation visual state
      this.updateActiveState();

      // Trigger any resize/layout adjustments
      if (typeof adjustBWVButtonLayout === 'function') {
        adjustBWVButtonLayout();
      }

      console.log(`✅ Successfully loaded ${workId}`);

    } catch (error) {
      console.error(`❌ Failed to load ${workId}:`, error);

      // Revert to previous work on error
      this.updateCurrentWork(previousWorkId);
      this.showNavigationError(error.message);

      // Revert URL if we changed it
      if (pushToHistory) {
        const url = new URL(window.location);
        url.searchParams.set('werk', previousWorkId.replace('bwv', ''));
        history.replaceState({ workId: previousWorkId }, '', url.toString());
      }
    } finally {
      this.isNavigating = false;
      this.hideNavigationLoading();
    }
  }

  async loadWorkContent(workId) {
    // Use the global loadWorkContent function from index.js
    if (typeof window.loadWorkContent === 'function') {
      await window.loadWorkContent(workId);
    } else {
      console.error('loadWorkContent function not available - falling back to page reload');
      // Fallback to page reload if dynamic loading isn't available
      const url = new URL(window.location);
      url.searchParams.set('werk', workId.replace('bwv', ''));
      window.location.href = url.toString();
    }
  }

  showNavigationLoading() {
    // Disable navigation buttons and show loading state
    document.querySelectorAll('[data-work-id]').forEach(btn => {
      if (btn.dataset.workId !== this.currentWorkId) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
      }
    });
  }

  hideNavigationLoading() {
    // Re-enable navigation buttons
    document.querySelectorAll('[data-work-id]').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '';
    });
  }

  showNavigationError(message) {
    console.error('Navigation error:', message);

    // Show error in the page if possible
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-warning alert-dismissible fade show';
    alertDiv.innerHTML = `
      <strong>Navigation Error:</strong> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector('.container-fluid') || document.body;
    container.insertBefore(alertDiv, container.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => alertDiv.remove(), 5000);
  }

  // Method to get navigation info for external use
  getNavigationInfo() {
    return {
      currentWork: this.currentWorkId,
      currentIndex: this.getCurrentWorkIndex(),
      totalWorks: this.availableWorks.length,
      availableWorks: this.availableWorks,
      hasPrevious: this.getCurrentWorkIndex() > 0,
      hasNext: this.getCurrentWorkIndex() < this.availableWorks.length - 1,
      isLoaded: this.isLoaded,
      isNavigating: this.isNavigating
    };
  }

  // Method to refresh BWV list
  async refresh() {
    console.log('🔄 Refreshing BWV navigation...');
    await this.loadAvailableWorks();
    this.createNavigationButtons();
    this.updateActiveState();
  }
}

// =============================================================================
// RESPONSIVE BWV BUTTON MANAGEMENT - NO FLASH VERSION
// =============================================================================

function adjustBWVButtonLayout() {
  const container = document.getElementById('bwv-buttons-container');
  if (!container) {
    console.warn('❌ BWV buttons container not found');
    return;
  }

  const buttons = container.querySelectorAll('.btn[data-work-id]');
  if (buttons.length === 0) {
    console.warn('❌ No buttons found in container');
    return;
  }

  // Reset to center-aligned, full text
  container.classList.remove('scrolling');
  container.parentElement?.classList.remove('scrolling');
  container.style.textAlign = 'center';

  buttons.forEach(btn => {
    const workId = btn.dataset.workId;
    if (workId) {
      const number = workId.replace('bwv', '');

      // Only update text if it doesn't have Wikipedia icon
      if (!btn.querySelector('.wiki-element')) {
        btn.textContent = `BWV ${number}`;
      } else {
        // Update just the text span for active button
        const textSpan = btn.querySelector('span:first-child');
        if (textSpan) {
          textSpan.textContent = `BWV ${number}`;
        }
      }
    }
  });

  // Check if we need horizontal scroll
  const buffer = 20;
  if (container.scrollWidth > (window.innerWidth - buffer)) {
    // Switch to scroll mode
    container.classList.add('scrolling');
    container.parentElement?.classList.add('scrolling');
    container.style.textAlign = 'left';

    // Shrink text if still too wide
    if (container.scrollWidth > (window.innerWidth - buffer + 40)) {
      buttons.forEach(btn => {
        const workId = btn.dataset.workId;
        if (workId) {
          const number = workId.replace('bwv', '');

          if (!btn.querySelector('.wiki-element')) {
            btn.textContent = number.toUpperCase();
          } else {
            const textSpan = btn.querySelector('span:first-child');
            if (textSpan) {
              textSpan.textContent = number.toUpperCase();
            }
          }
        }
      });
    }
    const bwvNav = window.getBWVNavigation();
    if (bwvNav) {
      bwvNav.scrollActiveIntoView();
    }
  }
}

// =============================================================================
// INITIALIZATION FUNCTION
// =============================================================================

let bwvNavigation = null;

async function initializeBWVNavigation() {
  if (document.readyState === 'loading') {
    return new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', async () => {
        bwvNavigation = new BWVNavigationMenu();
        await bwvNavigation.init();
        resolve(bwvNavigation);
      });
    });
  } else {
    bwvNavigation = new BWVNavigationMenu();
    await bwvNavigation.init();
    return bwvNavigation;
  }
}

// =============================================================================
// ES6 MODULE EXPORTS
// =============================================================================

export { BWVNavigationMenu, initializeBWVNavigation, adjustBWVButtonLayout };

// =============================================================================
// GLOBAL NAVIGATION INSTANCE ACCESS
// =============================================================================

// Make the navigation instance globally accessible for integration
window.getBWVNavigation = () => bwvNavigation;