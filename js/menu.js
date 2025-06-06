// =============================================================================
// BWV NAVIGATION MENU SYSTEM - Dynamic JSON-based version
// =============================================================================

class BWVNavigationMenu {
  constructor() {
    this.availableWorks = ['bwv1006']; // Fallback default
    this.currentWorkId = null;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.minSwipeDistance = 50;
    this.isLoaded = false;
    
    this.init();
  }

  async init() {
    this.updateCurrentWork();
    await this.loadAvailableWorks();
    this.createNavigationButtons();
    this.updateActiveState();
    this.attachEventListeners();
  }

  async loadAvailableWorks() {
    try {
      // console.log('📚 Loading BWV list from bwvs.json...');
      const response = await fetch('bwvs.json');
      
      if (!response.ok) {
        throw new Error(`Failed to load bwvs.json: ${response.status}`);
      }
      
      const bwvsData = await response.json();
      
      if (bwvsData.bwvs && Array.isArray(bwvsData.bwvs) && bwvsData.bwvs.length > 0) {
        this.availableWorks = bwvsData.bwvs.sort(); // Sort alphabetically
        // console.log(`✅ Loaded ${this.availableWorks.length} BWV works:`, this.availableWorks);
        // console.log(`📅 Generated: ${bwvsData.generated}`);
      } else {
        throw new Error('Invalid bwvs.json format or empty BWV list');
      }
      
      this.isLoaded = true;
      
    } catch (error) {
      console.warn('⚠️ Failed to load BWV list from bwvs.json:', error.message);
      console.log('📋 Using fallback BWV list:', this.availableWorks);
      
      // Show error in UI
      this.showLoadingError('Failed to load BWV navigation. Using fallback.');
      this.isLoaded = false;
    }
  }

  createNavigationButtons() {
    const container = document.getElementById('bwv-buttons-container');
    const loadingDiv = document.getElementById('bwv-loading');
    
    if (!container) {
      console.error('BWV buttons container not found');
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
      button.className = 'btn btn-sm btn-outline-dark';
      button.type = 'button';
      button.setAttribute('data-work-id', workId);
      
      // Format display text (BWV 1006 from bwv1006)
      const displayText = workId.replace(/^bwv/, 'BWV ').toUpperCase();
      button.textContent = displayText;
      
      container.appendChild(button);
    });

    console.log(`📱 Created ${this.availableWorks.length} navigation buttons`);
  }

  showLoadingError(message) {
    const container = document.getElementById('bwv-buttons-container');
    const loadingDiv = document.getElementById('bwv-loading');
    
    if (loadingDiv) {
      loadingDiv.className = 'text-warning small';
      loadingDiv.textContent = message;
    }
  }

  updateCurrentWork() {
    // Get current work from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const werkParam = urlParams.get('werk');
    
    if (werkParam) {
      this.currentWorkId = werkParam.match(/^\d+$/) ? `bwv${werkParam}` : werkParam;
    } else {
      this.currentWorkId = 'bwv1006'; // Default
    }
  }

  updateActiveState() {
    // Remove active styling from all buttons
    document.querySelectorAll('[data-work-id]').forEach(btn => {
      btn.classList.remove('btn-warning');
      btn.classList.add('btn-outline-dark');
    });
    
    // Add active styling to current work
    const activeBtn = document.querySelector(`[data-work-id="${this.currentWorkId}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('btn-outline-dark');
      activeBtn.classList.add('btn-warning');
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

    // Touch events for swipe gestures
    document.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipeGesture();
    }, { passive: true });

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

  handleSwipeGesture() {
    const swipeDistance = this.touchEndX - this.touchStartX;
    
    if (Math.abs(swipeDistance) < this.minSwipeDistance) {
      return; // Not a significant swipe
    }

    if (swipeDistance > 0) {
      // Swipe right - go to previous work
      this.navigateToPrevious();
    } else {
      // Swipe left - go to next work
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

  navigateToWork(workId) {
    // Show loading state
    // this.showTransitionLoading();
    
    // Update URL with new work parameter
    const url = new URL(window.location);
    url.searchParams.set('werk', workId.replace('bwv', ''));
    
    // Navigate to new work
    window.location.href = url.toString();
  }

  /*
  showTransitionLoading() {
    // Create a loading overlay for smooth transitions
    const overlay = document.createElement('div');
    overlay.className = 'bwv-transition-overlay';
    overlay.innerHTML = `
      <div class="bwv-transition-content">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2">Loading BWV...</div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // The overlay will be removed when the page reloads
  }
  */

  // Method to get navigation info for external use
  getNavigationInfo() {
    return {
      currentWork: this.currentWorkId,
      currentIndex: this.getCurrentWorkIndex(),
      totalWorks: this.availableWorks.length,
      availableWorks: this.availableWorks,
      hasPrevious: this.getCurrentWorkIndex() > 0,
      hasNext: this.getCurrentWorkIndex() < this.availableWorks.length - 1,
      isLoaded: this.isLoaded
    };
  }

  // Method to refresh BWV list (useful for debugging or if bwvs.json updates)
  async refresh() {
    console.log('🔄 Refreshing BWV navigation...');
    await this.loadAvailableWorks();
    this.createNavigationButtons();
    this.updateActiveState();
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

let bwvNavigation = null;

// Initialize navigation when DOM is ready
async function initializeBWVNavigation() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      bwvNavigation = new BWVNavigationMenu();
    });
  } else {
    bwvNavigation = new BWVNavigationMenu();
  }
}

// Export for use in other modules
window.BWVNavigationMenu = BWVNavigationMenu;
window.initializeBWVNavigation = initializeBWVNavigation;

// Auto-initialize
initializeBWVNavigation();