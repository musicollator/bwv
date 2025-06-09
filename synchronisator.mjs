/**
 * synchronisator.mjs - Unified Timing and Synchronization Module
 * 
 * Handles all music playback synchronization using the unified YAML format
 * from generate_sync.py. Eliminates the need for complex LilyPond timing
 * calibration by using pre-processed tick/bar data.
 */

export class Synchronisator {
  constructor(syncData, audioElement, svgElement, config) {
    // Validate inputs
    if (!syncData) {
      throw new Error('Synchronisator: syncData is required');
    }
    if (!syncData.meta) {
      console.error('syncData structure:', syncData);
      throw new Error('Synchronisator: syncData.meta is missing');
    }
    if (!syncData.flow) {
      throw new Error('Synchronisator: syncData.flow is missing');
    }
    if (!audioElement) {
      throw new Error('Synchronisator: audioElement is required');
    }
    if (!svgElement) {
      throw new Error('Synchronisator: svgElement is required');
    }
    if (!config) {
      throw new Error('Synchronisator: config is required');
    }

    this.syncData = syncData;
    this.audio = audioElement;
    this.svg = svgElement;
    this.config = config;
    
    // Timing state
    this.isPlaying = false;
    this.currentVisibleBar = -1;
    this.animationId = null;
    
    // Note management
    this.notes = [];
    this.remainingNotes = [];
    this.activeNotes = [];
    
    // Performance: Cache DOM elements
    this.barElementsCache = new Map(); // barNumber -> elements[]
    this.noteElementsCache = new Map(); // data-ref -> elements[]
    
    // Callbacks
    this.onBarChange = null; // Callback for when bar changes
    
    console.log('🎼 Synchronisator initializing with data:', {
      meta: this.syncData.meta,
      flowItems: this.syncData.flow?.length,
      configTitle: this.config.workInfo?.title
    });
    
    this.initialize();
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  initialize() {
    this.buildElementCaches();
    this.processNotes();
    console.log(`🎼 Synchronisator initialized: ${this.notes.length} notes, ${this.barElementsCache.size} bars`);
  }

  buildElementCaches() {
    // Cache bar elements
    const barElements = this.svg.querySelectorAll('[data-bar]');
    console.log(`🔍 Found ${barElements.length} bar elements`);
    
    barElements.forEach(element => {
      const barNumber = parseInt(element.getAttribute('data-bar'));
      if (!this.barElementsCache.has(barNumber)) {
        this.barElementsCache.set(barNumber, []);
      }
      this.barElementsCache.get(barNumber).push(element);
    });

    // Cache note elements  
    const noteElements = this.svg.querySelectorAll('[data-ref]');
    console.log(`🔍 Found ${noteElements.length} note elements with data-ref`);
    
    if (noteElements.length === 0) {
      console.warn('⚠️  No elements with data-ref found! Check SVG structure.');
      // Debug: show first few elements in SVG
      const allPaths = this.svg.querySelectorAll('path');
      console.log('📋 First 3 path elements:', Array.from(allPaths).slice(0, 3).map(el => ({
        attributes: Object.fromEntries(Array.from(el.attributes).map(attr => [attr.name, attr.value]))
      })));
    }

    noteElements.forEach(element => {
      const dataRef = element.getAttribute('data-ref');
      if (!this.noteElementsCache.has(dataRef)) {
        this.noteElementsCache.set(dataRef, []);
      }
      this.noteElementsCache.get(dataRef).push(element);
    });

    console.log(`📊 Cached elements: ${this.barElementsCache.size} bars, ${this.noteElementsCache.size} unique note refs`);
  }

  processNotes() {
    // Extract notes from flow data (filter out bars, handle new format)
    const flowNotes = this.syncData.flow
      .filter(item => item.length >= 3 && item[3] !== 'bar') // Notes have 3-4 elements, bars have 'bar' as 4th element
      .map(item => {
        // New format: [start_tick, channel, end_tick, hrefs]
        const [startTick, channel, endTick, hrefs] = item;
        
        return {
          startTick,
          endTick,
          hrefs: Array.isArray(hrefs) ? hrefs : [hrefs],
          channel: channel || 0, // Channel is now at index 1
          startTime: this.tickToSeconds(startTick),
          endTime: this.tickToSeconds(endTick),
          elements: this.getElementsForHrefs(hrefs)
        };
      });

    console.log(`🎵 Processing ${flowNotes.length} notes from flow data`);
    
    // Debug first few notes with channel info
    if (flowNotes.length > 0) {
      console.log('📝 First 3 notes:', flowNotes.slice(0, 3).map(note => ({
        startTick: note.startTick,
        startTime: note.startTime.toFixed(3),
        hrefs: note.hrefs,
        channel: note.channel,
        elementsFound: note.elements.length
      })));
    }

    // Check for notes with no elements
    const notesWithoutElements = flowNotes.filter(note => note.elements.length === 0);
    if (notesWithoutElements.length > 0) {
      console.warn(`⚠️  ${notesWithoutElements.length} notes have no matching SVG elements`);
      console.log('🔍 Sample missing hrefs:', notesWithoutElements.slice(0, 5).map(n => n.hrefs));
      
      // Show available data-ref values for comparison
      const availableRefs = Array.from(this.noteElementsCache.keys()).slice(0, 10);
      console.log('📋 Available data-ref values (first 10):', availableRefs);
    }

    // Sort by start time (notes should already be sorted by the Python script)
    this.notes = flowNotes.sort((a, b) => a.startTime - b.startTime);
    
    const notesWithElements = this.notes.filter(note => note.elements.length > 0);
    console.log(`✅ ${notesWithElements.length}/${this.notes.length} notes have matching SVG elements`);
    
    // Log channel distribution
    const channelCounts = {};
    this.notes.forEach(note => {
      channelCounts[note.channel] = (channelCounts[note.channel] || 0) + 1;
    });
    console.log('🎨 Channel distribution:', channelCounts);
    
    this.resetNoteState();
  }

  getElementsForHrefs(hrefs) {
    const hrefArray = Array.isArray(hrefs) ? hrefs : [hrefs];
    return hrefArray.flatMap(href => 
      this.noteElementsCache.get(href) || []
    ).filter(Boolean);
  }

  // =============================================================================
  // CORE TIMING FUNCTIONS
  // =============================================================================

  tickToSeconds(tick) {
    if (!this.syncData.meta) {
      throw new Error('tickToSeconds: syncData.meta is null');
    }
    
    const { minTick, maxTick } = this.syncData.meta;
    
    if (minTick === undefined || maxTick === undefined) {
      console.error('Meta data:', this.syncData.meta);
      throw new Error('tickToSeconds: minTick or maxTick is undefined');
    }
    
    if (maxTick === minTick) {
      console.warn('tickToSeconds: maxTick equals minTick, returning 0');
      return 0;
    }
    
    const totalDuration = this.config.musicalStructure.totalDurationSeconds;
    if (!totalDuration) {
      throw new Error('tickToSeconds: totalDurationSeconds is missing from config');
    }
    
    return ((tick - minTick) / (maxTick - minTick)) * totalDuration;
  }

  getCurrentBar(currentTime) {
    // Extract bar data from flow - bars are still [tick, None, bar_number, 'bar']
    const barTimings = this.syncData.flow
      .filter(item => item.length === 4 && item[3] === 'bar')
      .map(([tick, , barNumber]) => ({
        barNumber,
        startTime: this.tickToSeconds(tick)
      }))
      .sort((a, b) => a.startTime - b.startTime);

    // Find current bar
    for (let i = barTimings.length - 1; i >= 0; i--) {
      if (currentTime >= barTimings[i].startTime) {
        return barTimings[i].barNumber;
      }
    }

    return barTimings[0]?.barNumber || 1;
  }

  getVisualTime() {
    const leadTime = this.config.musicalStructure.visualLeadTimeSeconds || 0;
    return this.audio.currentTime + leadTime;
  }

  // =============================================================================
  // PLAYBACK CONTROL
  // =============================================================================

  start() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.syncLoop();
    
    console.log('🎵 Playback started');
  }

  stop() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.clearAllHighlights();
    this.hideAllBars();
    this.resetNoteState();
    
    console.log('⏹️ Playback stopped');
  }

  seek(targetTime) {
    const visualTime = targetTime + (this.config.musicalStructure.visualLeadTimeSeconds || 0);
    
    // Reset note states based on seek position
    this.remainingNotes = this.notes.filter(note => note.startTime > visualTime);
    this.activeNotes = this.notes.filter(note => 
      note.startTime <= visualTime && note.endTime > visualTime
    );
    
    // Update visual state
    this.clearAllHighlights();
    this.activeNotes.forEach(note => this.highlightNote(note));
    
    // Update bar visibility
    const currentBar = this.getCurrentBar(visualTime);
    this.showBar(currentBar);
    
    console.log(`⏭️ Seeked to ${targetTime.toFixed(2)}s (bar ${currentBar})`);
  }

  resetNoteState() {
    this.remainingNotes = [...this.notes];
    this.activeNotes = [];
    this.currentVisibleBar = -1;
  }

  // =============================================================================
  // SYNCHRONIZATION LOOP
  // =============================================================================

  syncLoop() {
    if (!this.isPlaying) return;

    const visualTime = this.getVisualTime();
    let activatedCount = 0;
    let deactivatedCount = 0;

    // Activate notes that should start
    while (this.remainingNotes.length && this.remainingNotes[0].startTime <= visualTime) {
      const note = this.remainingNotes.shift();
      this.highlightNote(note);
      this.activeNotes.push(note);
      activatedCount++;
    }

    // Deactivate notes that should end
    const initialActiveCount = this.activeNotes.length;
    this.activeNotes = this.activeNotes.filter(note => {
      if (note.endTime <= visualTime) {
        this.unhighlightNote(note);
        deactivatedCount++;
        return false;
      }
      return true;
    });

    // Log activity (but throttle to avoid spam)
    if (activatedCount > 0 || deactivatedCount > 0) {
      console.log(`🎵 @${visualTime.toFixed(2)}s: +${activatedCount} -${deactivatedCount} notes (${this.activeNotes.length} active, ${this.remainingNotes.length} remaining)`);
    }

    // Update bar visibility
    const currentBar = this.getCurrentBar(visualTime);
    if (currentBar !== this.currentVisibleBar) {
      console.log(`🎼 Bar change: ${this.currentVisibleBar} → ${currentBar}`);
      this.showBar(currentBar);
    }

    this.animationId = requestAnimationFrame(() => this.syncLoop());
  }

  // =============================================================================
  // VISUAL HIGHLIGHTING
  // =============================================================================

  highlightNote(note) {
    if (note.elements.length === 0) {
      console.warn('⚠️  Trying to highlight note with no elements:', note.hrefs);
      return;
    }
    
    console.log(`🌟 Highlighting note: ${note.hrefs.join(', ')} (channel ${note.channel}, ${note.elements.length} elements)`);
    
    note.elements.forEach(element => {
      element.classList.add('active');
      element.classList.add(`channel-${note.channel}`);
      console.log(`  ✅ Added 'active' and 'channel-${note.channel}' classes to:`, element.getAttribute('data-ref'));
    });
  }

  unhighlightNote(note) {
    console.log(`💫 Unhighlighting note: ${note.hrefs.join(', ')} (channel ${note.channel})`);
    
    note.elements.forEach(element => {
      element.classList.remove('active');
      element.classList.remove(`channel-${note.channel}`);
    });
  }

  clearAllHighlights() {
    // Updated for new data-ref structure
    this.svg.querySelectorAll('path[data-ref].active').forEach(element => {
      element.classList.remove('active');
      // Remove any channel classes
      for (let i = 0; i <= 5; i++) {
        element.classList.remove(`channel-${i}`);
      }
    });
  }

  // =============================================================================
  // BAR MANAGEMENT
  // =============================================================================

  showBar(barNumber) {
    if (barNumber === this.currentVisibleBar) return;

    this.hideAllBars();
    
    const barElements = this.barElementsCache.get(barNumber);
    if (barElements) {
      barElements.forEach(element => {
        element.style.visibility = 'visible';
      });
    }
    
    this.currentVisibleBar = barNumber;
    
    // Call callback if provided
    if (this.onBarChange && typeof this.onBarChange === 'function') {
      this.onBarChange(barNumber);
    }
  }

  hideAllBars() {
    this.barElementsCache.forEach(elements => {
      elements.forEach(element => {
        element.style.visibility = 'hidden';
      });
    });
    this.currentVisibleBar = -1;
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  getStats() {
    return {
      totalNotes: this.notes.length,
      activeNotes: this.activeNotes.length,
      remainingNotes: this.remainingNotes.length,
      currentBar: this.currentVisibleBar,
      isPlaying: this.isPlaying,
      notesWithElements: this.notes.filter(n => n.elements.length > 0).length,
      cachedBars: this.barElementsCache.size,
      cachedNoteRefs: this.noteElementsCache.size
    };
  }

  getCurrentBarNumber() {
    return this.getCurrentBar(this.getVisualTime());
  }

  // =============================================================================
  // DEBUG HELPERS
  // =============================================================================

  debug() {
    console.log('🔍 Synchronisator Debug Info:');
    console.log('📊 Stats:', this.getStats());
    console.log('🎵 Sample notes:', this.notes.slice(0, 3));
    console.log('📋 Available data-refs:', Array.from(this.noteElementsCache.keys()).slice(0, 10));
    console.log('🎼 Cached bars:', Array.from(this.barElementsCache.keys()).sort((a,b) => a-b));
    
    // Check CSS
    const activeElements = this.svg.querySelectorAll('.active');
    console.log(`🎨 Currently highlighted elements: ${activeElements.length}`);
    
    if (this.isPlaying) {
      console.log('⏯️  Currently playing at:', this.getVisualTime().toFixed(2), 's');
      console.log('🎯 Current bar:', this.getCurrentBar(this.getVisualTime()));
    }
    
    return this.getStats();
  }

  testHighlight(dataRef) {
    const elements = this.noteElementsCache.get(dataRef);
    if (elements) {
      console.log(`🧪 Testing highlight for: ${dataRef}`);
      elements.forEach(el => {
        el.classList.toggle('active');
        console.log('  Element:', el, 'Classes:', el.className);
      });
    } else {
      console.log(`❌ No elements found for: ${dataRef}`);
      console.log('Available refs:', Array.from(this.noteElementsCache.keys()).slice(0, 10));
    }
  }

  // =============================================================================
  // EVENT LISTENERS HELPER
  // =============================================================================

  attachAudioEvents() {
    this.audio.addEventListener('play', () => this.start());
    this.audio.addEventListener('pause', () => this.stop());
    this.audio.addEventListener('ended', () => this.stop());
    this.audio.addEventListener('seeked', () => this.seek(this.audio.currentTime));
  }
}