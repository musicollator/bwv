// Import unified timing system
import { Synchronisator } from './synchronisator.mjs';
// Import intelligent channel to color mapping (reads from CSS)
import { createChannelColorMapping, logChannelMapping } from '/js/channel2colour.js';
// Import BWV navigation menu system  
import { initializeBWVNavigation, adjustBWVButtonLayout } from '/js/menu.js';

import MusicalHighlighter, { quickHighlight, FuguePresets } from '/js/musical-highlighter.js';

// =============================================================================
// WERK PARAMETER PROCESSING
// =============================================================================

function processWerkParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const werkParam = urlParams.get('werk');
  const defaultWorkId = 'bwv1006';

  if (!werkParam) {
    return defaultWorkId;
  }

  const werkPattern = /^(?:\d+|test[^\d\s]*)$/;

  if (!werkPattern.test(werkParam)) {
    console.warn(`Invalid werk parameter: "${werkParam}". Using default: ${defaultWorkId}`);
    return defaultWorkId;
  }

  if (/^\d+$/.test(werkParam)) {
    return `bwv${werkParam}`;
  }

  if (/^test[^\d\s]*$/.test(werkParam)) {
    return werkParam;
  }

  return defaultWorkId;
}

// =============================================================================
// MEASURE HIGHLIGHTING SYSTEM - Updated for YAML Configuration
// =============================================================================

class MeasureHighlighter {
  constructor() {
    this.structures = new Map();
  }

  addStructure(name, config) {
    this.structures.set(name, config);
  }

  applyStructure(structureName) {
    this.clearHighlights();

    const structure = this.structures.get(structureName);
    if (!structure) {
      console.warn(`Structure '${structureName}' not found`);
      return;
    }

    const barElements = document.querySelectorAll('[data-bar]');
    barElements.forEach(element => {
      const barNumber = parseInt(element.getAttribute('data-bar'));
      const style = this.getStyleForBar(barNumber, structure);

      if (style) {
        Object.assign(element.style, style);
      }
    });
  }

  getStyleForBar(barNumber, structure) {
    if (structure.type === 'alternating') {
      const colorIndex = (barNumber - 1) % structure.colors.length;
      return {
        fill: structure.colors[colorIndex],
        fillOpacity: structure.opacity || '0.3'
      };
    }

    if (structure.type === 'conditional') {
      const colorIndex = this.evaluateCondition(barNumber, structure.condition);
      if (colorIndex >= 0 && colorIndex < structure.colors.length) {
        return {
          fill: structure.colors[colorIndex],
          fillOpacity: structure.opacity || '0.3'
        };
      }
    }

    if (structure.type === 'ranges') {
      for (const range of structure.ranges) {
        if (barNumber >= range.start && barNumber <= range.end) {
          return {
            fill: range.color,
            fillOpacity: structure.opacity || '0.3'
          };
        }
      }
    }

    return null;
  }

  evaluateCondition(barNumber, condition) {
    switch (condition.type) {
      case 'line-starts':
        return condition.bars.includes(barNumber) ? 0 : 1;
      case 'modulo':
        return (barNumber % condition.divisor === condition.remainder) ? 0 : 1;
      case 'specific-bars':
        return condition.bars.includes(barNumber) ? 1 : (condition.default_index || 0);
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return 0;
    }
  }

  clearHighlights() {
    const barElements = document.querySelectorAll('[data-bar]');
    barElements.forEach(element => {
      element.style.fill = '';
      element.style.fillOpacity = '';
    });
  }

  getStructureNames() {
    return Array.from(this.structures.keys());
  }

  getStructureDisplayName(structureName) {
    const structure = this.structures.get(structureName);
    return structure?.name || structureName.charAt(0).toUpperCase() + structureName.slice(1).replace('-', ' ');
  }

  // NEW: Clear all structures for work switching
  clearAllStructures() {
    this.structures.clear();
    this.clearHighlights();
  }
}

// Global measure highlighter instance
let measureHighlighter = null;

function initializeMeasureHighlighter() {
  if (!measureHighlighter) {
    measureHighlighter = new MeasureHighlighter();
  } else {
    // Clear existing structures when switching works
    measureHighlighter.clearAllStructures();
  }

  if (CONFIG?.measureHighlighters) {
    Object.entries(CONFIG.measureHighlighters).forEach(([key, config]) => {
      measureHighlighter.addStructure(key, config);
    });
  }

  updateMeasureControlsVisibility();
}

function updateMeasureControlsVisibility() {
  const measureControls = document.getElementById('measure-controls');
  
  // Always hide measure controls since it's experimental
  if (measureControls) {
    measureControls.style.display = 'none';
  }
  
  // Still initialize the measure highlighter functionality in the background
  // in case it's needed for debugging or future use
  const select = document.getElementById('highlight-select');
  if (!measureHighlighter || !select) return;

  const structureNames = measureHighlighter.getStructureNames();

  if (structureNames.length > 0) {
    // Clear existing options except "None"
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }

    // Add structure options (hidden, but available for debugging)
    structureNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = measureHighlighter.getStructureDisplayName(name);
      select.appendChild(option);
    });

    // Add event listener if not already added (for potential debugging use)
    if (!select.hasAttribute('data-listener-added')) {
      select.addEventListener('change', (e) => {
        if (e.target.value && measureHighlighter) {
          measureHighlighter.applyStructure(e.target.value);
        } else if (measureHighlighter) {
          measureHighlighter.clearHighlights();
        }
      });
      select.setAttribute('data-listener-added', 'true');
    }
  }
}

// =============================================================================
// CONFIGURATION SYSTEM - UPDATED FOR DYNAMIC LOADING
// =============================================================================

let CONFIG = null;

async function loadConfiguration(workId = null) {
  try {
    // Use provided workId or get from URL
    const targetWorkId = workId || processWerkParameter();
    
    const element = document.getElementById('loading-werk');
    if (element) {
      element.innerHTML = targetWorkId;
    }
    
    const configResponse = await fetch(`${targetWorkId}/exports/${targetWorkId}.config.yaml`);

    if (!configResponse.ok) {
      throw new Error(`Failed to load configuration for ${targetWorkId}`);
    }

    const yamlText = await configResponse.text();
    CONFIG = jsyaml.load(yamlText);

    // Update file paths for new unified format
    const basePath = `${targetWorkId}/exports/`;
    CONFIG.files.svgPath = `${basePath}${targetWorkId}.svg`;
    CONFIG.files.syncPath = `${basePath}${targetWorkId}.yaml`;
    CONFIG.files.audioPath = `${basePath}${CONFIG.files.audioPath}`;

    // Store the workId for reference
    CONFIG.workId = targetWorkId;

    applyConfiguration();
    return CONFIG;
  } catch (error) {
    console.error('Configuration loading error:', error);
    showConfigurationError(error.message);
    throw error;
  }
}

function applyConfiguration() {
  CONFIG = applyMobileTimingAdjustment(CONFIG);

  // Make CONFIG globally available for menu system
  window.CONFIG = CONFIG;

  document.title = CONFIG.workInfo.title;
  document.getElementById('page-title').textContent = CONFIG.workInfo.title;
  document.getElementById('total_bars').textContent = CONFIG.musicalStructure.totalMeasures;

  const audioSource = document.getElementById('audio-source');
  audioSource.src = CONFIG.files.audioPath;
  audio.load();
}

function showConfigurationError(message) {
  const loading = document.getElementById('loading');
  loading.innerHTML = `
    <div class="alert alert-danger" role="alert">
      <h4 class="alert-heading">Configuration Error</h4>
      <p>${message}</p>
      <hr>
      <p class="mb-0">Please check that the configuration file exists and is valid YAML.</p>
    </div>
  `;
}

// =============================================================================
// GLOBAL STATE VARIABLES - UPDATED FOR DYNAMIC LOADING
// =============================================================================

const audio = document.getElementById("audio");
let svgGlobal, bodyGlobal, headerElementGlobal, footerElementGlobal, currentBarGlobal;
let HEADER_HEIGHT = 120;

// Main synchronization system
let sync = null;

// Track initialization state
let isInitialized = false;

// =============================================================================
// DYNAMIC WORK LOADING FUNCTIONS - NEW
// =============================================================================

async function loadWorkContent(workId, isInitialLoad = false) {
  try {
    console.log(`🔄 Loading work content for ${workId}...`);
    
    // Show loading state only if not initial load
    const loadingElement = document.getElementById('loading');
    const svgContainer = document.getElementById("svg-container");
    
    if (loadingElement && !isInitialLoad) {
      loadingElement.classList.remove('d-none');
    }

    // 1. Load configuration
    await loadConfiguration(workId);

    // 2. Load SVG and sync data in parallel
    const [svgText, syncData] = await Promise.all([
      fetch(CONFIG.files.svgPath).then(r => {
        if (!r.ok) throw new Error(`Failed to load SVG: ${CONFIG.files.svgPath}`);
        return r.text();
      }),
      fetch(CONFIG.files.syncPath).then(r => {
        if (!r.ok) throw new Error(`Failed to load sync data: ${CONFIG.files.syncPath}`);
        return r.text();
      }).then(yamlText => {
        const parsed = jsyaml.load(yamlText);
        
        if (!parsed.meta) {
          throw new Error('Sync data missing "meta" section');
        }
        if (!parsed.flow) {
          throw new Error('Sync data missing "flow" section');
        }

        return parsed;
      })
    ]);

    // 3. Update SVG content
    svgContainer.innerHTML = svgText;
    svgGlobal = svgContainer.querySelector("svg");

    if (!svgGlobal) {
      throw new Error("SVG element not found in loaded content");
    }

    // 4. Stop current audio and sync (only if not initial load)
    if (!isInitialLoad) {
      audio.pause();
      audio.currentTime = 0;
    }
    
    // Clean up previous sync if it exists
    if (sync) {
      sync.stop();
      sync = null;
    }

    // 5. Initialize new synchronization system
    sync = new Synchronisator(syncData, audio, svgGlobal, CONFIG);
    window.sync = sync; // Make globally accessible

    // Set up custom bar display callback
    sync.onBarChange = (barNumber) => {
      currentBarGlobal.innerText = barNumber;
      scrollToBar(barNumber);
    };

    // 6. Apply channel colors and other work-specific features
    applyChannelColors(syncData);
    
    // 7. Re-initialize measure highlighter with new config
    initializeMeasureHighlighter();

    // 8. Update navigation state if navigation is initialized
    if (typeof window.getBWVNavigation === 'function') {
      const nav = window.getBWVNavigation();
      if (nav) {
        nav.updateCurrentWork(workId);
        nav.updateActiveState();
      }
    }

    // 9. Update UI state (only reset highlights if not initial load)
    if (isInitialLoad) {
      // Just set the current bar, don't try to clear highlights yet
      if (currentBarGlobal) {
        currentBarGlobal.innerText = '1';
      }
      setPlayingState(false);
    } else {
      updatePlaybackState();
    }
    
    checkScrollButtonVisibility();
    positionButtons();

    // Hide loading (only if we showed it)
    if (loadingElement && !isInitialLoad) {
      loadingElement.classList.add('d-none');
    }

    console.log(`✅ Successfully loaded ${workId}: ${sync.getStats().totalNotes} notes, ${sync.barElementsCache.size} bars`);
    
    return true;

  } catch (error) {
    console.error(`❌ Failed to load work content for ${workId}:`, error);
    showConfigurationError(error.message);
    throw error;
  }
}

// Reset current bar display
function updatePlaybackState() {
  if (currentBarGlobal) {
    currentBarGlobal.innerText = '1';
  }
  
  // Reset playing state
  setPlayingState(false);
  
  // Reset any active highlights using the correct method name
  if (window.highlighter && typeof window.highlighter.removeAllHighlights === 'function') {
    try {
      window.highlighter.removeAllHighlights();
    } catch (error) {
      console.warn('Could not clear highlights:', error);
    }
  }
}

// =============================================================================
// UI VISIBILITY MANAGEMENT
// =============================================================================

function checkScrollButtonVisibility() {
  if (!bodyGlobal || !svgGlobal || (sync && sync.isPlaying)) return;

  const svgRect = svgGlobal.getBoundingClientRect();
  const tolerance = 50;
  const optimalPosition = HEADER_HEIGHT + 20;
  const isAtOptimalPosition = (
    svgRect.top >= (optimalPosition - tolerance) &&
    svgRect.top <= (optimalPosition + tolerance)
  );

  if (isAtOptimalPosition) {
    bodyGlobal?.classList.add('svg-at-top');
  } else {
    bodyGlobal?.classList.remove('svg-at-top');
  }
}

// =============================================================================
// OPTIMIZED SMART SCROLLING SYSTEM
// =============================================================================

function scrollToBar(barNumber) {
  if (!sync) return;

  const barElements = sync.barElementsCache.get(barNumber);
  if (!barElements || barElements.length === 0) return;

  let minTop = Infinity, maxBottom = -Infinity;
  barElements.forEach(barElement => {
    const { top, bottom } = barElement.getBoundingClientRect();
    minTop = Math.min(minTop, top);
    maxBottom = Math.max(maxBottom, bottom);
  });

  const padding = 32;
  const viewportTop = HEADER_HEIGHT + padding;
  const viewportBottom = window.innerHeight;
  const isFullyVisible = minTop >= viewportTop && maxBottom <= viewportBottom;

  if (isFullyVisible) return;

  const currentScrollY = window.scrollY;
  const targetPageY = minTop + currentScrollY;
  const desiredScrollY = targetPageY - HEADER_HEIGHT - padding;

  window.scrollTo({
    top: desiredScrollY,
    behavior: 'smooth'
  });
}

// =============================================================================
// PLAYBACK STATE MANAGEMENT
// =============================================================================

function setPlayingState(isPlayingState) {
  if (!bodyGlobal) return;

  if (isPlayingState) {
    bodyGlobal?.classList.add('playing');
  } else {
    bodyGlobal?.classList.remove('playing');
  }
}

// =============================================================================
// CHANNEL TO COLOR MAPPING
// =============================================================================

function applyChannelColors(syncData) {
  if (!syncData || !svgGlobal) return;

  // Extract notes with channel information from flow data
  const notesWithChannels = syncData.flow
    .filter(item => item.length === 3) // Notes only
    .map(([, , hrefs]) => {
      return { hrefs: Array.isArray(hrefs) ? hrefs : [hrefs] };
    });

  // Apply color classes to note elements using data-ref
  notesWithChannels.forEach(note => {
    note.hrefs.forEach(href => {
      const elements = svgGlobal.querySelectorAll(`[data-ref="${href}"]`);
      elements.forEach(element => {
        element.classList.add(`channel-${note.channel || 0}`);
      });
    });
  });
}

// =============================================================================
// DYNAMIC BUTTON POSITIONING
// =============================================================================

function positionButtons() {
  if (!svgGlobal) return;

  const buttons = document.querySelectorAll('#button_scroll_to_top');
  const svgRect = svgGlobal.getBoundingClientRect();

  buttons.forEach(button => {
    const bRect = button.getBoundingClientRect()
    button.style.right = `${Math.ceil(Math.max(0, window.innerWidth - svgRect.right - (bRect.right - bRect.left)))}px`;
  });
}

// =============================================================================
// PERFORMANCE OPTIMIZATION
// =============================================================================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedPositionButtons = debounce(positionButtons, 50);
const debouncedCheckScroll = debounce(checkScrollButtonVisibility, 50);
const debouncedAdjustBWV = debounce(adjustBWVButtonLayout, 50);

// =============================================================================
// MOBILE DETECTION AND TIMING ADJUSTMENT
// =============================================================================

function isMobileDevice() {
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'webos'];
  const hasMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const smallScreen = window.screen.width <= 768;

  return hasMobileUA || (hasTouch && smallScreen);
}

function applyMobileTimingAdjustment(config) {
  const isMobile = isMobileDevice();
  const originalLeadTime = config.musicalStructure.visualLeadTimeSeconds ?? 0.0;

  if (isMobile) {
    const mobileAdjustment = 0.2;
    config.musicalStructure.visualLeadTimeSeconds = originalLeadTime + mobileAdjustment;
  } else {
    config.musicalStructure.visualLeadTimeSeconds = originalLeadTime;
  }

  return config;
}

// =============================================================================
// APPLICATION INITIALIZATION - UPDATED FOR DYNAMIC LOADING
// =============================================================================

async function setup() {
  try {
    // Initialize global references that don't change
    bodyGlobal = document.querySelector('body');
    headerElementGlobal = document.getElementById('header');
    footerElementGlobal = document.getElementById('footer');
    currentBarGlobal = document.getElementById('current_bar');
    
    // Make footer visible
    if (footerElementGlobal) {
      // footerElementGlobal.style.visibility = "visible";
    }

    HEADER_HEIGHT = 120;

    // Initialize global highlighter
    window.highlighter = new MusicalHighlighter();
    
    // Initialize BWV navigation menu system FIRST
    console.log('🚀 Starting BWV navigation initialization...');
    await initializeBWVNavigation();
    console.log('✅ BWV navigation initialization complete');

    // Load initial work content
    const initialWorkId = processWerkParameter();
    await loadWorkContent(initialWorkId, true); // true = isInitialLoad

    // Ensure navigation state is synchronized
    if (typeof window.getBWVNavigation === 'function') {
      const nav = window.getBWVNavigation();
      if (nav) {
        nav.updateCurrentWork(initialWorkId);
        nav.updateActiveState();
      }
    }

    // Initialize event handlers (only once)
    initEventHandlers();

    console.log('🎵 BWV Player fully loaded and ready!');

    // Show the interface
    checkScrollButtonVisibility();

    // Adjust BWV button layout after everything is loaded
    setTimeout(() => {
      adjustBWVButtonLayout();
    }, 100);

    isInitialized = true;

  } catch (err) {
    console.error("Setup error:", err);
    showConfigurationError(err.message);
    return;
  }

  document.getElementById('loading')?.classList.add("d-none");
}

// =============================================================================
// EVENT HANDLERS - UPDATED FOR DYNAMIC LOADING
// =============================================================================

function initEventHandlers() {
  // Only initialize once
  if (initEventHandlers.initialized) return;
  initEventHandlers.initialized = true;

  positionButtons();
  
  // Show UI elements
  document.querySelectorAll('#button_scroll_to_top, #bar_spy').forEach(button => {
    button.style.visibility = 'visible';
  });

  // Window event handlers
  window.addEventListener('resize', () => {
    debouncedPositionButtons();
    debouncedAdjustBWV();
  });

  window.addEventListener('scroll', debouncedCheckScroll);

  // Audio event handlers - these work with any sync instance
  audio.addEventListener("play", () => {
    setPlayingState(true);
    sync?.start();
  });

  audio.addEventListener("pause", () => {
    setPlayingState(false);
    sync?.stop();
  });

  audio.addEventListener("ended", () => {
    setPlayingState(false);
    sync?.stop();
    audio.currentTime = 0;
  });

  // Seeking handlers
  let seekingTimeout;
  audio.addEventListener('seeking', () => {
    bodyGlobal?.classList.add('seeking');
    clearTimeout(seekingTimeout);
    sync?.seek(audio.currentTime);
  });

  audio.addEventListener("seeked", () => {
    clearTimeout(seekingTimeout);
    seekingTimeout = setTimeout(() => {
      bodyGlobal?.classList.remove('seeking');
    }, 1000);
    sync?.seek(audio.currentTime);
  });
}

// =============================================================================
// GLOBAL API FOR DYNAMIC NAVIGATION - NEW
// =============================================================================

// Export loadWorkContent for use by navigation menu
// Default to false for isInitialLoad when called from navigation
window.loadWorkContent = (workId, isInitialLoad = false) => loadWorkContent(workId, isInitialLoad);

// Export other useful functions
window.getAppState = () => ({
  isInitialized,
  currentWork: CONFIG?.workId || null,
  sync,
  CONFIG
});

// Global references for debugging and integration
window.sync = null; // Will be set by loadWorkContent
window.CONFIG = null; // Will be set by loadConfiguration

// =============================================================================
// APPLICATION STARTUP
// =============================================================================

setup();