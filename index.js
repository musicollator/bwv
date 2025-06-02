// Import LilyPond timing system
import { initializeLilyPondTiming, createLilyPondGetCurrentBar, getLilyPondTimingInfo } from './bars.js';

// =============================================================================
// WERK PARAMETER PROCESSING
// =============================================================================

function processWerkParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const werkParam = urlParams.get('werk');
  
  // Default fallback
  const defaultWorkId = 'bwv1006';
  
  if (!werkParam) {
    console.log('No werk parameter found, using default:', defaultWorkId);
    return defaultWorkId;
  }
  
  // Validation pattern: either digits only OR 'test' followed by non-digit/non-space characters
  const werkPattern = /^(?:\d+|test[^\d\s]*)$/;
  
  if (!werkPattern.test(werkParam)) {
    console.warn(`Invalid werk parameter format: "${werkParam}". Expected digits only or 'test' followed by non-digit/non-space characters. Using default:`, defaultWorkId);
    return defaultWorkId;
  }
  
  // If it's only digits, prefix with 'bwv'
  if (/^\d+$/.test(werkParam)) {
    const workId = `bwv${werkParam}`;
    console.log(`Digits-only werk parameter "${werkParam}" converted to:`, workId);
    return workId;
  }
  
  // If it starts with 'test' and matches pattern, use as-is
  if (/^test[^\d\s]*$/.test(werkParam)) {
    console.log(`Test werk parameter used as-is:`, werkParam);
    return werkParam;
  }
  
  // Fallback (shouldn't reach here due to regex validation above)
  console.warn(`Unexpected werk parameter: "${werkParam}". Using default:`, defaultWorkId);
  return defaultWorkId;
}

// =============================================================================
// MEASURE HIGHLIGHTING SYSTEM
// =============================================================================

class MeasureHighlighter {
  constructor() {
    this.structures = new Map();
  }

  // Add a highlighting structure (e.g., harmonic, thematic, etc.)
  addStructure(name, config) {
    this.structures.set(name, config);
  }

  // Apply a specific structure
  applyStructure(structureName) {
    // Clear existing highlights
    this.clearHighlights();
    
    const structure = this.structures.get(structureName);
    if (!structure) {
      console.warn(`Structure '${structureName}' not found`);
      return;
    }

    // Find all elements with data-bar attributes
    const barElements = document.querySelectorAll('[data-bar]');
    
    barElements.forEach(element => {
      const barNumber = parseInt(element.getAttribute('data-bar'));
      const style = this.getStyleForBar(barNumber, structure);
      
      if (style) {
        Object.assign(element.style, style);
      }
    });
  }

  // Determine style for a specific bar based on structure
  getStyleForBar(barNumber, structure) {
    if (structure.type === 'alternating') {
      const colorIndex = (barNumber - 1) % structure.colors.length;
      return {
        fill: structure.colors[colorIndex],
        // fillOpacity: structure.opacity || '0.3'
      };
    }
    
    if (structure.type === 'conditional') {
      const colorIndex = structure.condition(barNumber);
      if (colorIndex >= 0 && colorIndex < structure.colors.length) {
        return {
          fill: structure.colors[colorIndex],
          // fillOpacity: structure.opacity || '0.3'
        };
      }
    }
    
    if (structure.type === 'ranges') {
      for (const range of structure.ranges) {
        if (barNumber >= range.start && barNumber <= range.end) {
          return {
            fill: range.color,
            // fillOpacity: structure.opacity || '0.3'
          };
        }
      }
    }
    
    return null;
  }

  // Clear all highlights
  clearHighlights() {
    const barElements = document.querySelectorAll('[data-bar]');
    barElements.forEach(element => {
      element.style.fill = '';
      element.style.fillOpacity = '';
    });
  }

  // Get all available structures
  getStructureNames() {
    return Array.from(this.structures.keys());
  }
}

// Global measure highlighter instance
let measureHighlighter = null;

function initializeMeasureHighlighter() {
  measureHighlighter = new MeasureHighlighter();

  // Add structures - you can load these from external files later
  measureHighlighter.addStructure('line-breaks', {
    type: 'conditional',
    colors: ['gainsboro', 'whitesmoke'],
    opacity: '0.3',
    condition: (barNumber) => {
      // Example line starts from your original BWV1006 structure
      const lineStarts = [1, 3, 7, 9, 17, 29, 33, 39, 43, 67, 79, 83, 90, 93, 99, 102, 109, 113, 119, 123, 130, 138];
      return lineStarts.includes(barNumber) ? 0 : 1;
    }
  });

  // Simple alternating colors
  measureHighlighter.addStructure('alternating', {
    type: 'alternating',
    colors: ['lightblue', 'lightgreen', 'lightyellow', 'lightpink'],
    opacity: '0.25'
  });

  // Example: Harmonic analysis (adjust ranges as needed)
  measureHighlighter.addStructure('harmonic', {
    type: 'ranges',
    opacity: '0.3',
    ranges: [
      { start: 1, end: 20, color: 'lightcyan' },
      { start: 21, end: 40, color: 'lightgreen' },
      { start: 41, end: 60, color: 'lightyellow' },
      { start: 61, end: 80, color: 'lightpink' },
      { start: 81, end: 100, color: 'lightblue' },
      { start: 101, end: 138, color: 'lavender' }
    ]
  });

  // Populate the select dropdown
  populateHighlightSelect();
}

function populateHighlightSelect() {
  const select = document.getElementById('highlight-select');
  if (!select || !measureHighlighter) return;

  // Clear existing options except "None"
  while (select.children.length > 1) {
    select.removeChild(select.lastChild);
  }

  // Add structure options
  measureHighlighter.getStructureNames().forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ');
    select.appendChild(option);
  });

  // Add event listener
  select.addEventListener('change', (e) => {
    if (e.target.value && measureHighlighter) {
      measureHighlighter.applyStructure(e.target.value);
    } else if (measureHighlighter) {
      measureHighlighter.clearHighlights();
    }
  });
}

// =============================================================================
// CONFIGURATION SYSTEM
// =============================================================================

let CONFIG = null; // Will be loaded from JSON

async function loadConfiguration() {
  try {
    // Get work ID using new werk parameter processing
    const workId = processWerkParameter();

    // Load YAML configuration file from work exports directory
    const configResponse = await fetch(`${workId}/exports/${workId}.config.yaml`);
    if (!configResponse.ok) {
      throw new Error(`Failed to load configuration for ${workId}`);
    }

    const yamlText = await configResponse.text();

    // Parse YAML using js-yaml library
    CONFIG = jsyaml.load(yamlText);

    // Massage file paths to include work directory structure
    CONFIG.files.svgPath = `${workId}/exports/${CONFIG.files.svgPath}`;
    CONFIG.files.notesPath = `${workId}/exports/${CONFIG.files.notesPath}`;
    CONFIG.files.audioPath = `${workId}/exports/${CONFIG.files.audioPath}`;

    console.log('Loaded configuration:', CONFIG);

    // Apply configuration to UI
    applyConfiguration();

    return CONFIG;
  } catch (error) {
    console.error('Configuration loading error:', error);
    // Fallback to default if config fails
    showConfigurationError(error.message);
    throw error;
  }
}

function applyConfiguration() {
  // Update page title and meta
  document.title = CONFIG.workInfo.title;
  document.getElementById('page-title').textContent = CONFIG.workInfo.title;

  // Update work title in header
  document.getElementById('work-title').textContent = CONFIG.workInfo.title;

  // Update total bars display
  document.getElementById('total_bars').textContent = CONFIG.musicalStructure.totalBars;

  // Update audio source
  const audioSource = document.getElementById('audio-source');
  audioSource.src = CONFIG.files.audioPath;
  audio.load(); // Reload audio with new source

  // Update Wikipedia link
  const wikiButton = document.getElementById('button_wikipedia');
  wikiButton.href = CONFIG.workInfo.externalURL;
  wikiButton.title = `Wikipedia: ${CONFIG.workInfo.fullTitle}`;
}

function generateChannelCSS() {
  // Channel colors are now hard-coded in CSS
  // This function is kept for potential future use
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
let convertedNotes = []; // Converted notes stored once after loading
let svgGlobal, noteDataGlobal, bodyGlobal, headerElementGlobal, footerElementGlobal, currentBarGlobal;
let isPlaying = false;
let currentVisibleBar = -1;
let HEADER_HEIGHT = 120; // Will be updated from config
let maxTick = 0; // Calculated from note data

// LilyPond timing integration
let lilyPondGetCurrentBar = null;

// =============================================================================
// MIDI TIMING CONVERSION (simple rule of three)
// =============================================================================

function tickToSeconds(tick) {
  if (maxTick === 0) return 0;
  // Simple linear mapping: (tick position / total ticks) * total duration
  return (tick / maxTick) * CONFIG.musicalStructure.totalDurationSeconds;
}

function convertNoteTiming(note) {
  // Handle tick format only
  if (note.on_tick !== undefined && note.off_tick !== undefined) {
    return {
      ...note,
      on: tickToSeconds(note.on_tick),
      off: tickToSeconds(note.off_tick)
    };
  }
  // If already in seconds format (shouldn't happen but handle gracefully)
  return note;
}

// =============================================================================
// CONFIGURATION-DEPENDENT CALCULATIONS
// =============================================================================

function getCurrentBar(currentTime) {
  // Use LilyPond timing if available, otherwise fall back to equal division
  if (lilyPondGetCurrentBar) {
    return lilyPondGetCurrentBar(currentTime);
  }
  
  // Simple fallback calculation
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
// NOTE DATA CONVERSION (called once after loading JSON)
// =============================================================================

function convertNotesFromTicks() {
  // Calculate max tick from note data (rule of three conversion)
  maxTick = Math.max(...noteDataGlobal.map(note =>
    Math.max(note.on_tick || 0, note.off_tick || 0)
  ));

  console.log(`Calculated max_tick: ${maxTick} ticks`);
  console.log(`Target duration: ${CONFIG.musicalStructure.totalDurationSeconds} seconds`);

  // Convert notes from tick format to runtime format (ONCE)
  convertedNotes = noteDataGlobal.map(rawNote => {
    // Convert timing using simple rule of three
    const note = convertNoteTiming(rawNote);

    // Find SVG elements for this note using hrefs
    const elements = note.hrefs.map(href => {
      const selector = `a[href$="${href}"]`;
      return svgGlobal.querySelector(selector);
    }).filter(Boolean);

    // Add channel-specific CSS classes for visual styling
    elements.forEach(el => {
      el.classList.add(`channel-${note.channel}`);
    });

    return {
      on: note.on,
      off: note.off,
      pitch: note.pitch,
      channel: note.channel,
      elements,
    };
  });

  // Sort notes by onset time for efficient processing
  convertedNotes.sort((a, b) => a.on - b.on);

  console.log(`Converted ${convertedNotes.length} notes from ticks to seconds`);
  console.log(`Tick range: 0 to ${maxTick} ticks`);
  console.log(`Converted time range: 0 to ${Math.max(...convertedNotes.map(n => n.off)).toFixed(2)} seconds`);
}

// =============================================================================
// NOTE DATA INITIALIZATION (called for resets)
// =============================================================================

function initializeNotes() {
  // Use pre-converted notes (no re-conversion needed)
  notes = [...convertedNotes];
  remainingNotes = [...notes];
  offCandidateNotes = [];
  unhighlightAllNotes();
  hideAllBars();

  console.log(`Initialized ${notes.length} notes for playback synchronization`);
}

// =============================================================================
// DYNAMIC BUTTON POSITIONING
// =============================================================================

function positionButtons() {
  if (!svgGlobal) return;

  const buttons = document.querySelectorAll('#button_wikipedia, #bar_spy');
  const scrollButton = document.getElementById('button_scroll_to_top');
  const svgRect = svgGlobal.getBoundingClientRect();

  buttons.forEach(button => {
    button.style.right = `${svgRect.left}px`;
    button.style.zIndex = '12';
  });

  if (scrollButton) {
    scrollButton.style.right = `${window.innerWidth - svgRect.right}px`;
    scrollButton.style.bottom = '20px';
  }
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
      return false; // Remove from array
    }
    return true; // Keep in array
  });

  // Update bar highlighting with smooth transitions
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
    // First load configuration
    await loadConfiguration();

    // Then load work-specific files
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
    HEADER_HEIGHT = 120; // Hard-coded header height

    if (!svgGlobal) {
      throw new Error("SVG element not found in loaded content");
    }

    // Convert notes from ticks to seconds (ONCE)
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
      originalGetCurrentBar
    );
    
    if (lilyPondActive) {
      lilyPondGetCurrentBar = createLilyPondGetCurrentBar();
    }

    // Initialize components
    initializeNotes();
    initEventHandlers();

    // Initialize measure highlighting after SVG is loaded
    initializeMeasureHighlighter();
    
    // Show measure controls
    // document.getElementById('measure-controls').style.display = 'block';

    console.log(`Loaded ${notes.length} notes for ${CONFIG.workInfo.title}`);
    console.log(`Musical structure: ${CONFIG.musicalStructure.totalBars} bars in ${CONFIG.musicalStructure.totalDurationSeconds}s`);

    // Log timing system status
    const timingInfo = getLilyPondTimingInfo();
    if (timingInfo.isActive) {
      console.log('✅ Using LilyPond-calibrated bar timing');
    } else {
      console.log('⚠️ Using equal-division bar timing (fallback)');
    }

    // Log timing format detection
    if (noteDataGlobal.length > 0) {
      const sampleNote = noteDataGlobal[0];
      if (sampleNote.on_tick !== undefined) {
        console.log('Detected tick timing format - using rule of three conversion');
      } else {
        console.log('Detected seconds timing format');
      }
    }

  } catch (err) {
    console.error("Setup error:", err);
    showConfigurationError(err.message);
    return;
  }

  // Hide loading spinner
  document.getElementById("loading")?.classList.add("d-none");
  checkScrollButtonVisibility();
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

function initEventHandlers() {
  // Initialize UI
  positionButtons();
  document.querySelectorAll('#button_wikipedia, #button_scroll_to_top, #bar_spy').forEach(button => {
    button.style.visibility = 'visible';
  });

  // Window events
  window.addEventListener('resize', debouncedPositionButtons);
  window.addEventListener('scroll', debouncedCheckScroll);

  // Audio events
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

  // Seeking events with improved responsiveness
  let seekingTimeout;
  function handleSeek() {
    if (!CONFIG) return;

    const now = audio.currentTime;
    const visualTime = now + CONFIG.musicalStructure.visualLeadTimeSeconds;

    // Reset note states based on current position
    remainingNotes = notes.filter(note => note.on > visualTime);
    offCandidateNotes = notes.filter(note => note.on <= visualTime && note.off > visualTime);

    // Update visual highlighting
    unhighlightAllNotes();
    offCandidateNotes.forEach(note => highlightNote(note));

    // Update bar highlighting
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

// Start the application
setup();