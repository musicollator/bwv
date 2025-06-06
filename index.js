// Import LilyPond timing system
import { initializeLilyPondTiming, createLilyPondGetCurrentBar, getLilyPondTimingInfo } from '/js/bars.js';

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

    // Massage file paths
    CONFIG.files.svgPath = `${workId}/exports/${CONFIG.files.svgPath}`;
    CONFIG.files.notesPath = `${workId}/exports/${CONFIG.files.notesPath}`;
    CONFIG.files.audioPath = `${workId}/exports/${CONFIG.files.audioPath}`;

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
  document.getElementById('total_bars').textContent = CONFIG.musicalStructure.totalBars;

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
      <p class="mb-0">Please check that the configuration file exists and is valid JSON.</p>
    </div>
  `;
}

// =============================================================================
// GLOBAL STATE VARIABLES
// =============================================================================

const audio = document.getElementById("audio");
let notes = [], remainingNotes = [], offCandidateNotes = [];
let convertedNotes = [];
let svgGlobal, noteDataGlobal, bodyGlobal, headerElementGlobal, footerElementGlobal, currentBarGlobal;
let isPlaying = false;
let currentVisibleBar = -1;
let HEADER_HEIGHT = 120;
let maxTick = 0;

// LilyPond timing integration
let lilyPondGetCurrentBar = null;

// =============================================================================
// MIDI TIMING CONVERSION
// =============================================================================

function tickToSeconds(tick) {
  if (maxTick === 0) return 0;
  return (tick / maxTick) * CONFIG.musicalStructure.totalDurationSeconds;
}

function convertNoteTiming(note) {
  if (note.on_tick !== undefined && note.off_tick !== undefined) {
    return {
      ...note,
      on: tickToSeconds(note.on_tick),
      off: tickToSeconds(note.off_tick)
    };
  }
  return note;
}

// =============================================================================
// CONFIGURATION-DEPENDENT CALCULATIONS
// =============================================================================

function getCurrentBar(currentTime) {
  if (lilyPondGetCurrentBar) {
    return lilyPondGetCurrentBar(currentTime);
  }

  const secondsPerBar = CONFIG.musicalStructure.totalDurationSeconds / CONFIG.musicalStructure.totalBars;
  const barNumber = Math.floor(currentTime / secondsPerBar) + 1;
  return Math.max(1, Math.min(CONFIG.musicalStructure.totalBars, barNumber));
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
    unhighlightAllNotes();
    hideAllBars();
    currentVisibleBar = -1;
  }
}

// =============================================================================
// UI VISIBILITY MANAGEMENT
// =============================================================================

function checkScrollButtonVisibility() {
  if (!bodyGlobal || !svgGlobal || isPlaying) return;

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
// SMART SCROLLING SYSTEM
// =============================================================================

function scrollToBar(barNumber) {
  const rects = document.querySelectorAll(`rect[data-bar="${barNumber}"]`);
  if (rects.length === 0) return;

  let minTop = Infinity, maxBottom = -Infinity;
  rects.forEach(rect => {
    const boundingRect = rect.getBoundingClientRect();
    minTop = Math.min(minTop, boundingRect.top);
    maxBottom = Math.max(maxBottom, boundingRect.bottom);
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
// BAR MANAGEMENT
// =============================================================================

function hideAllBars() {
  document.querySelectorAll('rect[data-bar]').forEach(rect => {
    rect.style.visibility = 'hidden';
  });
  currentVisibleBar = -1;
}

function showBar(barNumber) {
  scrollToBar(barNumber);
  currentBarGlobal.innerText = barNumber;
  document.querySelectorAll(`rect[data-bar="${barNumber}"]`).forEach(rect => {
    rect.style.visibility = 'visible';
  });
}

// =============================================================================
// NOTE HIGHLIGHTING SYSTEM
// =============================================================================

function highlightNote(note) {
  note.elements.forEach(el => el.classList.add("active"));
}

function unhighlightNote(note) {
  note.elements.forEach(el => el.classList.remove("active"));
}

function unhighlightAllNotes() {
  if (!svgGlobal) return;
  svgGlobal.querySelectorAll('a[href]:not([href=""]).active').forEach(el => {
    el.classList.remove("active")
  });
}

// =============================================================================
// NOTE DATA CONVERSION
// =============================================================================

function convertNotesFromTicks() {
  maxTick = Math.max(...noteDataGlobal.map(note =>
    Math.max(note.on_tick || 0, note.off_tick || 0)
  ));

  // Create channel mapping from actual MIDI channels to color indices
  const usedChannels = [...new Set(noteDataGlobal.map(note => note.channel))].sort((a, b) => a - b);
  const channelColorMap = new Map();
  usedChannels.forEach((channel, index) => {
    channelColorMap.set(channel, index);
  });

  convertedNotes = noteDataGlobal.map(rawNote => {
    const note = convertNoteTiming(rawNote);

    const elements = note.hrefs.map(href => {
      const selector = `a[href$="${href}"]`;
      return svgGlobal.querySelector(selector);
    }).filter(Boolean);

    // Map actual MIDI channel to color index
    const colorIndex = channelColorMap.get(note.channel);
    elements.forEach(el => {
      el.classList.add(`channel-${colorIndex}`);
    });

    return {
      on: note.on,
      off: note.off,
      pitch: note.pitch,
      channel: note.channel,
      colorIndex: colorIndex, // Store both for debugging
      elements,
    };
  });

  convertedNotes.sort((a, b) => a.on - b.on);
  
  // Log MIDI channel information with color mapping
  logMidiChannels(channelColorMap);
}

function logMidiChannels(channelColorMap) {
  const channelStats = new Map();
  const colorNames = ['coral', 'lightgreen', 'dodgerblue', 'bach-gold', 'mediumpurple', 'lightpink'];
  
  // Count notes per channel
  convertedNotes.forEach(note => {
    if (!channelStats.has(note.channel)) {
      channelStats.set(note.channel, {
        count: 0,
        pitchRange: { min: Infinity, max: -Infinity }
      });
    }
    
    const stats = channelStats.get(note.channel);
    stats.count++;
    stats.pitchRange.min = Math.min(stats.pitchRange.min, note.pitch);
    stats.pitchRange.max = Math.max(stats.pitchRange.max, note.pitch);
  });
  
  // Sort channels numerically
  const sortedChannels = Array.from(channelStats.keys()).sort((a, b) => a - b);
  
  console.log('🎵 MIDI Channels → Colors:');
  sortedChannels.forEach(channel => {
    const stats = channelStats.get(channel);
    const colorIndex = channelColorMap.get(channel);
    const colorName = colorNames[colorIndex] || `color-${colorIndex}`;
    const pitchInfo = stats.pitchRange.min !== Infinity 
      ? `(pitch ${stats.pitchRange.min}-${stats.pitchRange.max})`
      : '';
    console.log(`  Channel ${channel} → ${colorName}: ${stats.count} notes ${pitchInfo}`);
  });
  
  console.log(`📊 Total: ${sortedChannels.length} channels, ${convertedNotes.length} notes`);
}

function initializeNotes() {
  notes = [...convertedNotes];
  remainingNotes = [...notes];
  offCandidateNotes = [];
  unhighlightAllNotes();
  hideAllBars();
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
// REAL-TIME PLAYBACK SYNCHRONIZATION  
// =============================================================================

function syncLoop() {
  if (!isPlaying || !CONFIG) return;

  const now = audio.currentTime;
  const visualTime = now + CONFIG.musicalStructure.visualLeadTimeSeconds;

  // Activate notes that should start playing
  while (remainingNotes.length && remainingNotes[0].on <= visualTime) {
    const note = remainingNotes.shift();
    highlightNote(note);
    offCandidateNotes.push(note);
  }

  // Deactivate notes that should stop playing
  offCandidateNotes = offCandidateNotes.filter(note => {
    if (note.off <= visualTime) {
      unhighlightNote(note);
      return false;
    }
    return true;
  });

  // Update bar highlighting
  const currentBar = getCurrentBar(visualTime);
  if (currentBar !== currentVisibleBar) {
    hideAllBars();
    showBar(currentBar);
    currentVisibleBar = currentBar;
  }

  requestAnimationFrame(syncLoop);
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

async function setup() {
  try {
    await loadConfiguration();

    const [svgText, noteData] = await Promise.all([
      fetch(CONFIG.files.svgPath).then(r => {
        if (!r.ok) throw new Error(`Failed to load SVG: ${CONFIG.files.svgPath}`);
        return r.text();
      }),
      fetch(CONFIG.files.notesPath).then(r => {
        if (!r.ok) throw new Error(`Failed to load notes: ${CONFIG.files.notesPath}`);
        return r.json();
      })
    ]);

    noteDataGlobal = noteData;

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

    convertNotesFromTicks();

    // Initialize LilyPond timing system
    const originalGetCurrentBar = (currentTime) => {
      const secondsPerBar = CONFIG.musicalStructure.totalDurationSeconds / CONFIG.musicalStructure.totalBars;
      const barNumber = Math.floor(currentTime / secondsPerBar) + 1;
      return Math.max(1, Math.min(CONFIG.musicalStructure.totalBars, barNumber));
    };

    const lilyPondActive = initializeLilyPondTiming(
      convertedNotes,
      CONFIG.musicalStructure.totalDurationSeconds,
      originalGetCurrentBar,
      CONFIG
    );

    if (lilyPondActive) {
      lilyPondGetCurrentBar = createLilyPondGetCurrentBar();
    }

    initializeNotes();
    initEventHandlers();
    initializeMeasureHighlighter();

    // Essential info only
    console.log(`🎼 ${CONFIG.workInfo.title} loaded: ${notes.length} notes, ${CONFIG.musicalStructure.totalBars} bars`);
    
    const timingInfo = getLilyPondTimingInfo();
    if (timingInfo.isActive) {
      console.log('✅ LilyPond timing active');
    }

  } catch (err) {
    console.error("Setup error:", err);
    showConfigurationError(err.message);
    return;
  }

  document.getElementById("loading")?.classList.add("d-none");
  checkScrollButtonVisibility();
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

function initEventHandlers() {
  positionButtons();
  document.querySelectorAll('#button_wikipedia, #button_scroll_to_top, #bar_spy').forEach(button => {
    button.style.visibility = 'visible';
  });

  window.addEventListener('resize', debouncedPositionButtons);
  window.addEventListener('scroll', debouncedCheckScroll);

  audio.addEventListener("play", () => {
    isPlaying = true;
    setPlayingState(true);
    requestAnimationFrame(syncLoop);
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    setPlayingState(false);
  });

  audio.addEventListener("ended", () => {
    isPlaying = false;
    setPlayingState(false);
    audio.currentTime = 0;
    initializeNotes();
    currentVisibleBar = -1;
  });

  let seekingTimeout;
  function handleSeek() {
    if (!CONFIG) return;

    const now = audio.currentTime;
    const visualTime = now + CONFIG.musicalStructure.visualLeadTimeSeconds;

    remainingNotes = notes.filter(note => note.on > visualTime);
    offCandidateNotes = notes.filter(note => note.on <= visualTime && note.off > visualTime);

    unhighlightAllNotes();
    offCandidateNotes.forEach(note => highlightNote(note));

    const currentBar = getCurrentBar(visualTime);
    hideAllBars();
    showBar(currentBar);
    currentVisibleBar = currentBar;
  }

  audio.addEventListener('seeking', () => {
    bodyGlobal?.classList.add('seeking');
    clearTimeout(seekingTimeout);
    handleSeek();
  });

  audio.addEventListener("seeked", () => {
    clearTimeout(seekingTimeout);
    seekingTimeout = setTimeout(() => {
      bodyGlobal?.classList.remove('seeking');
      hideAllBars();
    }, 1000);
    handleSeek();
  });
}

// =============================================================================
// APPLICATION STARTUP
// =============================================================================

setup();