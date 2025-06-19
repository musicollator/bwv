/**
 * synchronisator.mjs - Unified Timing and Synchronization Module
 * 
 * Handles all music playback synchronization using the unified YAML format
 * from generate_sync.py. Eliminates the need for complex LilyPond timing
 * calibration by using pre-processed tick/bar data.
 */

// Import intelligent channel to color mapping (reads from CSS)
import { createChannelColorMapping, logChannelMapping } from '/js/channel2colour.js';
// Import debounce utility
import debounce from '/js/lodash.debounce.mjs';

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

    // Channel color mapping
    this.channelColorMap = new Map();

    // Performance: Cache DOM elements
    this.barElementsCache = new Map();  // barNumber -> elements[]
    this.noteElementsCache = new Map(); // data-ref -> elements[]

    // console.log('🎼 Synchronisator initializing with data:', {
    //   meta: this.syncData.meta,
    //   flowItems: this.syncData.flow?.length,
    //   configTitle: this.config.workInfo?.title
    // });

    this.initialize();
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  initialize() {
    this.buildElementCaches();
    this.processNotes();
    this.setupChannelColorMapping();
    // console.log(`🎼 Synchronisator initialized: ${this.notes.length} notes, ${this.barElementsCache.size} bars`);
  }

  buildElementCaches() {
    // Cache bar elements
    const barElements = this.svg.querySelectorAll('[data-bar]');
    // console.log(`🔍 Found ${barElements.length} bar elements`);

    barElements.forEach(element => {
      const barNumber = parseInt(element.getAttribute('data-bar'));
      if (!this.barElementsCache.has(barNumber)) {
        this.barElementsCache.set(barNumber, []);
      }
      this.barElementsCache.get(barNumber).push(element);
    });

    // Cache note elements  
    const noteElements = this.svg.querySelectorAll('[data-ref]');
    // console.log(`🔍 Found ${noteElements.length} note elements with data-ref`);

    if (noteElements.length === 0) {
      console.warn('⚠️  No elements with data-ref found! Check SVG structure.');
      // Debug: show first few elements in SVG
      const allPaths = this.svg.querySelectorAll('path');
      // console.log('📋 First 3 path elements:', Array.from(allPaths).slice(0, 3).map(el => ({
      //   attributes: Object.fromEntries(Array.from(el.attributes).map(attr => [attr.name, attr.value]))
      // })));
    }

    noteElements.forEach(element => {
      const dataRef = element.getAttribute('data-ref');
      if (!this.noteElementsCache.has(dataRef)) {
        this.noteElementsCache.set(dataRef, []);
      }
      this.noteElementsCache.get(dataRef).push(element);
    });

    // console.log(`📊 Cached elements: ${this.barElementsCache.size} bars, ${this.noteElementsCache.size} unique note refs`);
  }

  processNotes() {
    // Extract notes from flow data (filter out bars and fermatas)
    const flowNotes = this.syncData.flow
      .filter(item => item.length >= 3 && item[3] !== 'bar' && item[3] !== 'fermata') // Filter out bars and fermatas
      .map(item => {
        // New format: [start_tick, channel, end_tick, hrefs]
        const [startTick, channel, endTick, hrefs] = item;

        const startTime = this.tickToSeconds(startTick);
        const endTime = this.tickToSeconds(endTick);

        return {
          startTick,
          endTick,
          hrefs: Array.isArray(hrefs) ? hrefs : [hrefs],
          channel: channel || 0, // Channel is now at index 1
          startTime,
          endTime,
          elements: this.getElementsForHrefs(hrefs)
        };
      });

    // console.log(`🎵 Processing ${flowNotes.length} notes from flow data`);

    // Debug first few notes with channel info
    // if (flowNotes.length > 0) {
    //   console.log('📝 First 3 notes:', flowNotes.slice(0, 3).map(note => ({
    //     startTick: note.startTick,
    //     startTime: note.startTime.toFixed(3),
    //     hrefs: note.hrefs,
    //     channel: note.channel,
    //     elementsFound: note.elements.length
    //   })));
    // }

    // Check for notes with no elements
    const notesWithoutElements = flowNotes.filter(note => note.elements.length === 0);
    if (notesWithoutElements.length > 0) {
      console.warn(`⚠️  ${notesWithoutElements.length} notes have no matching SVG elements`);
      console.log('🔍 Sample missing hrefs:', notesWithoutElements.slice(0, 5).map(n => n.hrefs));

      // Show available data-ref values for comparison
      // const availableRefs = Array.from(this.noteElementsCache.keys()).slice(0, 10);
      // console.log('📋 Available data-ref values (first 10):', availableRefs);
    }

    // Sort by start time (notes should already be sorted by the Python script)
    this.notes = flowNotes.sort((a, b) => a.startTime - b.startTime);

    const notesWithElements = this.notes.filter(note => note.elements.length > 0);
    // console.log(`✅ ${notesWithElements.length}/${this.notes.length} notes have matching SVG elements`);

    // Log channel distribution
    // const channelCounts = {};
    // this.notes.forEach(note => {
    //   channelCounts[note.channel] = (channelCounts[note.channel] || 0) + 1;
    // });
    // console.log('🎨 Channel distribution:', channelCounts);

    this.resetNoteState();
  }

  setupChannelColorMapping() {
    // Use channel statistics from meta.channels if available
    if (this.syncData.meta.channels) {
      try {
        // Convert meta.channels to the format expected by createChannelColorMapping
        const channelData = [];

        for (const [channelStr, stats] of Object.entries(this.syncData.meta.channels)) {
          const channel = parseInt(channelStr);

          // Create mock note data with just the info needed for mapping
          for (let i = 0; i < stats.count; i++) {
            channelData.push({
              channel: channel,
              pitch: stats.minPitch + (i / stats.count) * (stats.maxPitch - stats.minPitch) // Distribute across range
            });
          }
        }

        // console.log('🎨 Using channel statistics from meta.channels:', this.syncData.meta.channels);

        // Create mapping using the intelligent system from channel2colour.js
        this.channelColorMap = createChannelColorMapping(channelData);

        // Apply color classes to all note elements
        this.notes.forEach(note => {
          const colorIndex = this.channelColorMap.get(note.channel);
          if (colorIndex !== undefined) {
            note.elements.forEach(element => {
              element.classList.add(`channel-${colorIndex}`);
            });
          }
        });

        // Log the mapping results with channel stats
        // if (this.channelColorMap.size > 0) {
        //   logChannelMapping(this.channelColorMap, channelData);
        // } else {
        //   console.log('🎵 No channel mapping applied (single channel or no channel data)');
        // }

      } catch (error) {
        console.error('🚨 Error setting up channel color mapping from meta:', error);
        this.fallbackChannelMapping();
      }
    } else {
      console.warn('⚠️  No meta.channels found, using fallback mapping');
      this.fallbackChannelMapping();
    }
  }

  fallbackChannelMapping() {
    // Fallback: use raw channel numbers
    // console.log('🎨 Using fallback channel mapping (raw channel numbers)');
    this.notes.forEach(note => {
      note.elements.forEach(element => {
        element.classList.add(`channel-${note.channel}`);
      });
    });
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
    // Convert tick to seconds using proportional mapping
    // Maps tick range [minTick, maxTick] to musical duration, then adds musicStartSeconds offset
    const { minTick, maxTick, musicStartSeconds } = this.syncData.meta;
    const totalDuration = this.config.musicalStructure.totalDurationSeconds;
    const musicalDuration = totalDuration - (musicStartSeconds || 0);

    if (maxTick === minTick) {
      return musicStartSeconds || 0;
    }

    // Map ticks to musical duration, then offset by silence
    const musicalTime = ((tick - minTick) / (maxTick - minTick)) * musicalDuration;
    const result = musicalTime + (musicStartSeconds || 0);

    // Debug first few ticks
    // if (tick <= 2500) {
    //   console.log(`🔍 DEBUGGING tick ${tick}: minTick=${minTick}, maxTick=${maxTick}, musicStartSeconds=${musicStartSeconds}, totalDuration=${totalDuration}, musicalDuration=${musicalDuration}, musicalTime=${musicalTime.toFixed(3)}, result=${result.toFixed(3)}`);
    // }

    return result;
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

    // console.log('🎵 Playback started');
  }

  stop() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.clearAllHighlights();
    this.showBar(-1)
    this.resetNoteState();

    // console.log('⏹️ Playback stopped');
  }

  updateVisualSync(targetTime) {
    // Reset note states based on target time
    this.remainingNotes = this.notes.filter(note => note.startTime > targetTime);
    this.activeNotes = this.notes.filter(note =>
      note.startTime <= targetTime && note.endTime > targetTime
    );

    // Update visual state
    this.clearAllHighlights();
    this.activeNotes.forEach(note => this.highlightNote(note));

    // Update bar visibility
    const currentBar = this.getCurrentBar(targetTime);
    this.showBar(currentBar);

    // console.log(`⏭️ Updated visual sync to ${targetTime.toFixed(2)}s (bar ${currentBar})`);
  }

  resetNoteState() {
    this.remainingNotes = [...this.notes];
    this.activeNotes = [];
    this.currentVisibleBar = -1;
  }

  getBarStartTime(barNumber) {
    // Extract bar start time from flow data
    const barTimings = this.syncData.flow
      .filter(item => item.length === 4 && item[3] === 'bar')
      .map(([tick, , barNum]) => ({
        barNumber: barNum,
        startTime: this.tickToSeconds(tick)
      }));

    const barData = barTimings.find(bar => bar.barNumber === barNumber);
    return barData ? barData.startTime : 0;
  }

  snapToBarStart() {
    const visualTime = this.getVisualTime();
    const currentBar = this.getCurrentBar(visualTime);
    const barStartTime = this.getBarStartTime(currentBar);

    // Account for visual lead time when setting audio position
    const leadTime = this.config.musicalStructure.visualLeadTimeSeconds || 0;
    return barStartTime - leadTime;
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
    // if (activatedCount > 0 || deactivatedCount > 0) {
    //   console.log(`🎵 @${visualTime.toFixed(2)}s: +${activatedCount} -${deactivatedCount} notes (${this.activeNotes.length} active, ${this.remainingNotes.length} remaining)`);
    // }

    // Update bar visibility
    const currentBar = this.getCurrentBar(visualTime);
    if (currentBar !== this.currentVisibleBar) {
      // console.log(`🎼 Bar change: ${this.currentVisibleBar} → ${currentBar}`);
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

    // Use mapped color index instead of raw channel
    const colorIndex = this.channelColorMap.get(note.channel) ?? note.channel;

    // console.log(`🌟 Highlighting note: ${note.hrefs.join(', ')} (channel ${note.channel} → color ${colorIndex}, ${note.elements.length} elements)`);

    note.elements.forEach(element => {
      element.classList.add('active');
      // Note: channel class was already added during initialization
      // console.log(`  ✅ Added 'active' class to:`, element.getAttribute('data-ref'));
    });
  }

  unhighlightNote(note) {
    const colorIndex = this.channelColorMap.get(note.channel) ?? note.channel;
    // console.log(`💫 Unhighlighting note: ${note.hrefs.join(', ')} (channel ${note.channel} → color ${colorIndex})`);

    note.elements.forEach(element => {
      element.classList.remove('active');
      // Keep channel class for consistent coloring
    });
  }

  clearAllHighlights() {
    // Updated for new data-ref structure
    this.svg.querySelectorAll('path[data-ref].active').forEach(element => {
      element.classList.remove('active');
      // Keep channel classes for consistent coloring
    });
  }

  // =============================================================================
  // BAR MANAGEMENT
  // =============================================================================

  showBar(barNumber) {
    if (barNumber === this.currentVisibleBar) return;

    this.barElementsCache.forEach(elements => {
      elements.forEach(element => {
        element.style.visibility = 'hidden';
      });
    });
    this.currentVisibleBar = -1;

    if (barNumber === -1) return;

    const barElements = this.barElementsCache.get(barNumber);
    if (barElements) {
      barElements.forEach(element => {
        element.style.visibility = 'visible';
      });
    }

    this.currentVisibleBar = barNumber;

    // Call the bar change callback if it exists
    if (this.onBarChange) {
      this.onBarChange(barNumber);
    }
  }

  hideAllBars() {
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
      cachedNoteRefs: this.noteElementsCache.size,
      channelMapping: Object.fromEntries(this.channelColorMap)
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
    console.log('🎼 Cached bars:', Array.from(this.barElementsCache.keys()).sort((a, b) => a - b));
    console.log('🎨 Channel mapping:', Object.fromEntries(this.channelColorMap));

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
  // AUDIO EVENT HANDLERS
  // =============================================================================

  initializeAudioEventHandlers(callbacks = {}) {
    // Store callbacks for UI updates
    this.callbacks = {
      onPlayStateChange: callbacks.onPlayStateChange || (() => { }),
      onBarChange: callbacks.onBarChange || (() => { }),
      onSeekStart: callbacks.onSeekStart || (() => { }),
      onSeekEnd: callbacks.onSeekEnd || (() => { })
    };

    // Set up bar change callback
    this.onBarChange = (barNumber) => {
      this.callbacks.onBarChange(barNumber);
    };

    // Only initialize event listeners once per audio element
    if (!this.audio._bwvEventListenersInitialized) {
      // Audio play event
      this.audio.addEventListener("play", this._handlePlay = () => {
        this.callbacks.onPlayStateChange(true);
        this.start();
      });

      // Audio pause event
      this.audio.addEventListener("pause", this._handlePause = () => {
        this.callbacks.onPlayStateChange(false);
        this.stop();
      });

      // Audio ended event
      this.audio.addEventListener("ended", this._handleEnded = () => {
        this.callbacks.onPlayStateChange(false);
        this.stop();
        this.audio.currentTime = 0;
      });

      // Seeking handlers - handle bar snapping and visual sync
      this.initializeSeekingHandlers();

      // Mark as initialized to prevent duplicate listeners
      this.audio._bwvEventListenersInitialized = true;
    }
  }

  // Clean up event listeners (called when Synchronisator is destroyed)
  cleanup() {
    if (this.audio._bwvEventListenersInitialized) {
      this.audio.removeEventListener("play", this._handlePlay);
      this.audio.removeEventListener("pause", this._handlePause);
      this.audio.removeEventListener("ended", this._handleEnded);

      // Clean up seeking handlers
      if (this._handleSeeking) {
        this.audio.removeEventListener("seeking", this._handleSeeking);
      }
      if (this._handleSeeked) {
        this.audio.removeEventListener("seeked", this._handleSeeked);
      }

      this.audio._bwvEventListenersInitialized = false;
    }
  }

  initializeSeekingHandlers() {
    let userIsSeeking = false;
    let programmaticSeek = false;

    // Simple debounced bar snapping
    const debouncedBarSnap = debounce(() => {
      if (programmaticSeek || !userIsSeeking) {
        return;
      }

      // Clear user seeking state FIRST to prevent re-entry
      userIsSeeking = false;
      this.callbacks.onSeekEnd();

      const currentAudioTime = this.audio.currentTime;
      const barStartTime = this.snapToBarStart();

      // Only snap if there's a meaningful difference
      if (Math.abs(currentAudioTime - barStartTime) > 0.1) {
        programmaticSeek = true;
        this.audio.currentTime = barStartTime;

        // Force visual sync update after snapping
        setTimeout(() => {
          this.updateVisualSync(barStartTime);
        }, 50); // Small delay to ensure audio time has been set
      }
    }, 500); // Longer delay to ensure user has finished

    // Track when user starts seeking
    this.audio.addEventListener('seeking', this._handleSeeking = () => {
      if (!programmaticSeek) {
        this.callbacks.onSeekStart();
        userIsSeeking = true;
      }
      const visualTime = this.getVisualTime();
      this.updateVisualSync(visualTime);
    });

    // Track when seek operation completes
    this.audio.addEventListener("seeked", this._handleSeeked = () => {
      if (programmaticSeek) {
        programmaticSeek = false;
        return;
      }

      // Trigger debounced bar snapping
      debouncedBarSnap();
    });
  }


}