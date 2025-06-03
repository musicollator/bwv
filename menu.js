// =============================================================================
// BWV NAVIGATION MENU SYSTEM - Simplified HTML-based version
// =============================================================================

class BWVNavigationMenu {
  constructor() {
    this.availableWorks = ['bwv1006', 'bwv543']; // Add more as needed
    this.currentWorkId = null;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.minSwipeDistance = 50;
    
    this.init();
  }

  init() {
    this.updateCurrentWork();
    this.updateActiveState();
    this.attachEventListeners();
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
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-secondary');
    });
    
    // Add active styling to current work
    const activeBtn = document.querySelector(`[data-work-id="${this.currentWorkId}"]`);
    if (activeBtn) {
      activeBtn.classList.remove('btn-outline-secondary');
      activeBtn.classList.add('btn-primary');
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
    this.showTransitionLoading();
    
    // Update URL with new work parameter
    const url = new URL(window.location);
    url.searchParams.set('werk', workId.replace('bwv', ''));
    
    // Navigate to new work
    window.location.href = url.toString();
  }

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

  // Method to get navigation info for external use
  getNavigationInfo() {
    return {
      currentWork: this.currentWorkId,
      currentIndex: this.getCurrentWorkIndex(),
      totalWorks: this.availableWorks.length,
      availableWorks: this.availableWorks,
      hasPrevious: this.getCurrentWorkIndex() > 0,
      hasNext: this.getCurrentWorkIndex() < this.availableWorks.length - 1
    };
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

let bwvNavigation = null;

// Initialize navigation when DOM is ready
function initializeBWVNavigation() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
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