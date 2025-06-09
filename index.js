// Import unified timing system
import { Synchronisator } from './synchronisator.mjs';
// Import intelligent channel to color mapping (reads from CSS)
import { createChannelColorMapping, logChannelMapping } from '/js/channel2colour.js';

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
}

// Global measure highlighter instance
let measureHighlighter = null;

function initializeMeasureHighlighter() {
  measureHighlighter = new MeasureHighlighter();

  if (CONFIG?.measureHighlighters) {
    Object.entries(CONFIG.measureHighlighters).forEach(([key, config]) => {
      measureHighlighter.addStructure(key, config);
    });
  }

  updateMeasureControlsVisibility();
}

function updateMeasureControlsVisibility() {
  const measureControls = document.getElementById('measure-controls');
  const select = document.getElementById('highlight-select');

  if (!measureHighlighter || !measureControls || !select) return;

  const structureNames = measureHighlighter.getStructureNames();

  if (structureNames.length === 0) {
    measureControls.style.display = 'none';
    return;
  }

  // Clear existing options except "None"
  while (select.children.length > 1) {
    select.removeChild(select.lastChild);
  }

  // Add structure options
  structureNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = measureHighlighter.getStructureDisplayName(name);
    select.appendChild(option);
  });

  if (structureNames.length === 1) {
    select.disabled = true;
    select.value = structureNames[0];
    measureHighlighter.applyStructure(structureNames[0]);
  } else {
    select.disabled = false;
  }

  // Add event listener if not already added
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

// =============================================================================
// CONFIGURATION SYSTEM
// =============================================================================

let CONFIG = null;

async function loadConfiguration() {
  try {
    const workId = processWerkParameter();
    const configResponse = await fetch(`${workId}/exports/${workId}.config.yaml`);

    if (!configResponse.ok) {
      throw new Error(`Failed to load configuration for ${workId}`);
    }

    const yamlText = await configResponse.text();
    CONFIG = jsyaml.load(yamlText);

    // Update file paths for new unified format
    const basePath = `${workId}/exports/`;
    CONFIG.files.svgPath = `${basePath}${workId}.svg`;           // Cleaned SVG
    CONFIG.files.syncPath = `${basePath}${workId}.yaml`;         // Unified timing data
    CONFIG.files.audioPath = `${basePath}${CONFIG.files.audioPath}`;

    console.log('📁 File paths configured:', {
      svgPath: CONFIG.files.svgPath,
      syncPath: CONFIG.files.syncPath,
      audioPath: CONFIG.files.audioPath
    });

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

  document.title = CONFIG.workInfo.title;
  document.getElementById('page-title').textContent = CONFIG.workInfo.title;
  document.getElementById('total_bars').textContent = CONFIG.musicalStructure.totalMeasures;

  const audioSource = document.getElementById('audio-source');
  audioSource.src = CONFIG.files.audioPath;
  audio.load();

  const wikiButton = document.getElementById('button_wikipedia');
  wikiButton.href = CONFIG.workInfo.externalURL;
  wikiButton.title = `Wikipedia: ${CONFIG.workInfo.fullTitle}`;
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
// GLOBAL STATE VARIABLES (Simplified)
// =============================================================================

const audio = document.getElementById("audio");
let svgGlobal, bodyGlobal, headerElementGlobal, footerElementGlobal, currentBarGlobal;
let HEADER_HEIGHT = 120;

// Main synchronization system
let sync = null;

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
// PLAYBACK STATE MANAGEMENT (Simplified)
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
// CHANNEL TO COLOR MAPPING (Updated for data-ref)
// =============================================================================

function applyChannelColors(syncData) {
  if (!syncData || !svgGlobal) return;

  // Extract notes with channel information from flow data
  const notesWithChannels = syncData.flow
    .filter(item => item.length === 3) // Notes only
    .map(([, , hrefs]) => {
      // Find corresponding note data with channel info
      // This would need to be passed from the sync data or reconstructed
      return { hrefs: Array.isArray(hrefs) ? hrefs : [hrefs] };
    });

  // Apply color classes to note elements using data-ref
  notesWithChannels.forEach(note => {
    note.hrefs.forEach(href => {
      const elements = svgGlobal.querySelectorAll(`[data-ref="${href}"]`);
      elements.forEach(element => {
        // Apply channel-based color class
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

  const buttons = document.querySelectorAll('#button_wikipedia, #button_scroll_to_top');
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
// RESPONSIVE BWV BUTTON MANAGEMENT
// =============================================================================

function adjustBWVButtonLayout() {
  const container = document.getElementById('bwv-buttons-container');
  const buttons = container.querySelectorAll('.btn');

  if (buttons.length === 0) return;

  // Reset to original text first
  buttons.forEach(btn => {
    const workId = btn.dataset.workId;
    if (workId) {
      const number = workId.replace('bwv', '');
      btn.textContent = `BWV ${number}`;
    }
  });

  // Reset container styles
  container.style.justifyContent = 'center';
  container.style.overflowX = 'visible';

  // Force a reflow
  container.offsetWidth;

  // Check if container exceeds viewport width
  if (container.scrollWidth > window.innerWidth) {
    // Step 1: Remove "BWV " prefix
    buttons.forEach(btn => {
      const workId = btn.dataset.workId;
      if (workId) {
        const number = workId.replace('bwv', '');
        btn.textContent = number.toUpperCase();
      }
    });

    // Force another reflow
    container.offsetWidth;

    // Check again after removing BWV
    if (container.scrollWidth > window.innerWidth) {
      // Step 2: Enable horizontal scroll
      container.style.justifyContent = 'flex-start';
      container.style.overflowX = 'auto';
    }
  }
}

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
    const mobileAdjustment = 0.2; // 200ms additional lead time for mobile
    config.musicalStructure.visualLeadTimeSeconds = originalLeadTime + mobileAdjustment;
  } else {
    config.musicalStructure.visualLeadTimeSeconds = originalLeadTime;
  }

  return config;
}

// =============================================================================
// APPLICATION INITIALIZATION (Simplified)
// =============================================================================

async function setup() {
  try {
    // Load configuration
    await loadConfiguration();

    // Load unified sync data and SVG in parallel
    const [svgText, syncData] = await Promise.all([
      fetch(CONFIG.files.svgPath).then(r => {
        if (!r.ok) throw new Error(`Failed to load SVG: ${CONFIG.files.svgPath}`);
        return r.text();
      }),
      fetch(CONFIG.files.syncPath).then(r => {
        if (!r.ok) throw new Error(`Failed to load sync data: ${CONFIG.files.syncPath}`);
        return r.text();
      }).then(yamlText => {
        console.log('📄 Raw YAML loaded, parsing...');
        const parsed = jsyaml.load(yamlText);
        console.log('✅ YAML parsed successfully:', {
          hasMeta: !!parsed.meta,
          hasFlow: !!parsed.flow,
          metaKeys: parsed.meta ? Object.keys(parsed.meta) : 'none',
          flowLength: parsed.flow ? parsed.flow.length : 0
        });
        
        // Validate structure
        if (!parsed.meta) {
          throw new Error('Sync data missing "meta" section');
        }
        if (!parsed.flow) {
          throw new Error('Sync data missing "flow" section');
        }
        
        return parsed;
      })
    ]);

    // Initialize DOM references
    const svgContainer = document.getElementById("svg-container");
    svgContainer.innerHTML = svgText;
    bodyGlobal = document.querySelector('body');
    svgGlobal = svgContainer.querySelector("svg");
    headerElementGlobal = document.getElementById('header');
    footerElementGlobal = document.getElementById('footer');
    footerElementGlobal.style.visibility = "visible";
    currentBarGlobal = document.getElementById('current_bar');

    HEADER_HEIGHT = 120;

    if (!svgGlobal) {
      throw new Error("SVG element not found in loaded content");
    }

    // Initialize the unified synchronization system
    sync = new Synchronisator(syncData, audio, svgGlobal, CONFIG);
    
    // Make synchronisator globally accessible for debugging
    window.sync = sync;
    
    // Set up custom bar display callback
    sync.onBarChange = (barNumber) => {
      currentBarGlobal.innerText = barNumber;
      scrollToBar(barNumber);
    };

    // Apply channel colors (if channel data is available)
    applyChannelColors(syncData);

    initEventHandlers();
    initializeMeasureHighlighter();

    console.log(`🎼 ${CONFIG.workInfo.title} loaded: ${sync.getStats().totalNotes} notes, ${sync.barElementsCache.size} bars`);
    console.log('🔍 Debug: Type sync.debug() in console for detailed info');
    console.log('🧪 Debug: Type sync.testHighlight("test-main.ly:14:23") to test highlighting');
    console.log('🎨 Debug: Check if .active CSS class exists and is visible');
    console.log('🎵 BWV Player fully loaded and ready!');

    // Show the interface
    checkScrollButtonVisibility();
    setTimeout(adjustBWVButtonLayout, 100);

  } catch (err) {
    console.error("Setup error:", err);
    showConfigurationError(err.message);
    return;
  }

  document.getElementById("loading")?.classList.add("d-none");
}

// =============================================================================
// EVENT HANDLERS (Simplified)
// =============================================================================

function initEventHandlers() {
  positionButtons();
  document.querySelectorAll('#button_wikipedia, #button_scroll_to_top, #bar_spy').forEach(button => {
    button.style.visibility = 'visible';
  });

  window.addEventListener('resize', () => {
    debouncedPositionButtons();
    debouncedAdjustBWV();
  });

  window.addEventListener('scroll', debouncedCheckScroll);

  // Audio event handlers - simplified with synchronisator
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

  // Seeking - much simpler with synchronisator
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
// APPLICATION STARTUP
// =============================================================================

setup();