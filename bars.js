// bars.js - LilyPond Timing Integration Module (Fixed for Anacrusis)
// Provides accurate bar timing by calibrating LilyPond moments to real-time audio

class LilyPondTimingSystem {
  constructor() {
    this.timingData = null;
    this.isActive = false;
    this.originalGetCurrentBar = null;
  }

  /**
   * Extract LilyPond timing data from SVG attributes (fixed for anacrusis)
   */
  extractTimings() {
    // Get ALL bar elements, not just those with timing data
    const allBarElements = document.querySelectorAll('[data-bar]');
    if (allBarElements.length === 0) {
      console.log('No LilyPond bar data found in SVG');
      return null;
    }

    // Extract all bars with their timing data
    const timingData = [];
    let hasPickupBar = false;
    let pickupBar = null;

    allBarElements.forEach(element => {
      const barNumber = parseInt(element.getAttribute('data-bar'));
      const momentStr = element.getAttribute('data-bar-moment-main');
      
      if (!isNaN(barNumber)) {
        if (momentStr) {
          // Regular bar with timing data
          timingData.push({
            bar: barNumber,
            moment: this.parseFraction(momentStr),
            isPickup: false
          });
        } else {
          // Pickup bar (no moment data)
          pickupBar = {
            bar: barNumber,
            moment: 0, // Will be calculated
            isPickup: true
          };
          hasPickupBar = true;
        }
      }
    });

    // Sort regular bars by moment
    timingData.sort((a, b) => a.moment - b.moment);

    // Handle pickup bar timing
    if (hasPickupBar && pickupBar && timingData.length > 0) {
      // Calculate pickup duration from first regular bar's moment
      const firstRegularMoment = timingData[0].moment;
      pickupBar.moment = 0; // Pickup starts at moment 0
      
      // Insert pickup bar at the beginning
      timingData.unshift(pickupBar);
      
      console.log(`Pickup bar detected: Bar ${pickupBar.bar}, duration: ${firstRegularMoment} moments`);
    }

    // Remove duplicates (shouldn't happen, but safety check)
    const uniqueTimings = [];
    let lastMoment = -Infinity;
    timingData.forEach(timing => {
      if (timing.moment !== lastMoment) {
        uniqueTimings.push(timing);
        lastMoment = timing.moment;
      }
    });

    console.log('Extracted LilyPond timings (with anacrusis support):', uniqueTimings);
    return uniqueTimings;
  }

  /**
   * Calibrate LilyPond moments to real-time seconds using MIDI data (corrected understanding)
   */
  calibrate(convertedNotes, totalDurationSeconds, config = null) {
    const lilypondTimings = this.extractTimings();
    if (!lilypondTimings || !convertedNotes || convertedNotes.length === 0) {
      console.log('Cannot calibrate: missing LilyPond or MIDI data');
      return null;
    }

    // Find actual musical boundaries from MIDI
    const firstNote = convertedNotes[0];
    const lastNote = convertedNotes[convertedNotes.length - 1];
    const musicStartSeconds = firstNote.on;
    const musicEndSeconds = Math.max(lastNote.on, lastNote.off);
    const musicalDurationSeconds = musicEndSeconds - musicStartSeconds;

    // Get timing data
    const allMoments = lilypondTimings.map(t => t.moment);
    const minMoment = Math.min(...allMoments);
    const lastBarStartMoment = Math.max(...allMoments);
    
    // Determine last bar duration from config
    let lastBarDuration = 1.0; // Default: assume 4/4 time (1 whole note)
    
    console.log('=== Config Debug ===');
    console.log('config:', config);
    console.log('config?.musicalStructure:', config?.musicalStructure);
    console.log('config?.musicalStructure?.lastBarDuration:', config?.musicalStructure?.lastBarDuration);
    
    if (config && config.musicalStructure && config.musicalStructure.lastBarDuration !== undefined) {
      lastBarDuration = this.parseFraction(config.musicalStructure.lastBarDuration.toString());
      console.log(`✓ Using config lastBarDuration: ${config.musicalStructure.lastBarDuration} = ${lastBarDuration} whole notes`);
    } else {
      console.log(`⚠ No config provided or lastBarDuration missing - assuming last bar is complete (${lastBarDuration} whole notes)`);
      if (!config) console.log('  → config is null/undefined');
      if (config && !config.musicalStructure) console.log('  → config.musicalStructure is missing');
      if (config && config.musicalStructure && config.musicalStructure.lastBarDuration === undefined) console.log('  → config.musicalStructure.lastBarDuration is missing');
    }
    console.log('===================');
    
    // Calculate actual musical end: last bar start + last bar duration
    const musicalEndMoment = lastBarStartMoment + lastBarDuration;
    const totalMusicalSpan = musicalEndMoment - minMoment;

    // Calibration
    const secondsPerMomentUnit = musicalDurationSeconds / totalMusicalSpan;

    console.log('=== LilyPond Calibration (Corrected) ===');
    console.log(`MIDI: ${musicalDurationSeconds.toFixed(3)}s`);
    console.log(`Last bar starts at: ${lastBarStartMoment} whole notes`);
    console.log(`Last bar duration: ${lastBarDuration} whole notes`);
    console.log(`Musical span: ${minMoment} to ${musicalEndMoment} = ${totalMusicalSpan} whole notes`);
    console.log(`Tempo: ${secondsPerMomentUnit.toFixed(4)}s per whole note`);

    // Convert all moments to absolute seconds
    const barTimings = lilypondTimings.map(timing => ({
      bar: timing.bar,
      moment: timing.moment,
      seconds: musicStartSeconds + (timing.moment - minMoment) * secondsPerMomentUnit,
      isPickup: timing.isPickup || false
    }));

    const result = {
      barTimings: barTimings,
      musicStartSeconds: musicStartSeconds,
      musicEndSeconds: musicEndSeconds,
      musicalDurationSeconds: musicalDurationSeconds,
      secondsPerMomentUnit: secondsPerMomentUnit,
      hasPreMusicSilence: musicStartSeconds > 0.05,
      hasPostMusicSilence: totalDurationSeconds - musicEndSeconds > 0.5,
      hasPickupBar: lilypondTimings.some(t => t.isPickup)
    };

    console.log('Bar timings:', barTimings.map(t => 
      `Bar ${t.bar}${t.isPickup ? ' (pickup)' : ''}: ${t.seconds.toFixed(3)}s (moment ${t.moment})`
    ));
    console.log('=======================================');

    this.timingData = result;
    return result;
  }

  /**
   * Get current bar using LilyPond-calibrated timings (updated for anacrusis)
   */
  getCurrentBar(currentTime, fallbackFunction) {
    if (!this.isActive || !this.timingData) {
      return fallbackFunction(currentTime);
    }

    const { barTimings, musicStartSeconds, musicEndSeconds, hasPostMusicSilence, hasPickupBar } = this.timingData;

    // Handle pre-music time
    if (currentTime < musicStartSeconds) {
      // Return pickup bar if it exists, otherwise first bar
      return hasPickupBar ? barTimings[0].bar : barTimings[0].bar;
    }

    // Handle post-music silence
    if (hasPostMusicSilence && currentTime > musicEndSeconds) {
      return barTimings[barTimings.length - 1].bar; // Last bar
    }

    // Find current bar from timings
    for (let i = 0; i < barTimings.length - 1; i++) {
      if (currentTime >= barTimings[i].seconds && currentTime < barTimings[i + 1].seconds) {
        return barTimings[i].bar;
      }
    }

    // Past last timing
    return barTimings[barTimings.length - 1].bar;
  }

  /**
   * Parse LilyPond fraction strings like '13/8' or '1'
   */
  parseFraction(fractionStr) {
    if (fractionStr.includes('/')) {
      const [num, den] = fractionStr.split('/').map(parseFloat);
      return num / den;
    }
    return parseFloat(fractionStr);
  }

  /**
   * Initialize the LilyPond timing system (with config support)
   */
  initialize(convertedNotes, totalDurationSeconds, getCurrentBarFunction, config = null) {
    console.log('Initializing LilyPond timing system (with config support for incomplete measures)...');
    
    // Store original function for fallback
    this.originalGetCurrentBar = getCurrentBarFunction;
    
    // Calibrate LilyPond moments to real time
    const calibrationResult = this.calibrate(convertedNotes, totalDurationSeconds, config);
    
    if (calibrationResult) {
      this.isActive = true;
      console.log('✅ LilyPond timing system active (with config support)');
      return true;
    } else {
      console.log('⚠️ Using fallback timing system');
      return false;
    }
  }

  /**
   * Create a wrapped getCurrentBar function that uses LilyPond timing
   */
  createGetCurrentBarFunction() {
    return (currentTime) => {
      return this.getCurrentBar(currentTime, this.originalGetCurrentBar);
    };
  }

  /**
   * Get timing information for debugging
   */
  getTimingInfo() {
    return {
      isActive: this.isActive,
      timingData: this.timingData
    };
  }

  /**
   * Disable LilyPond timing and revert to fallback
   */
  disable() {
    this.isActive = false;
    console.log('LilyPond timing system disabled');
  }
}

// Create and export singleton instance
const lilyPondTiming = new LilyPondTimingSystem();

// Export the main functions for use in other modules
export function initializeLilyPondTiming(convertedNotes, totalDurationSeconds, getCurrentBarFunction, config = null) {
  return lilyPondTiming.initialize(convertedNotes, totalDurationSeconds, getCurrentBarFunction, config);
}

export function createLilyPondGetCurrentBar() {
  return lilyPondTiming.createGetCurrentBarFunction();
}

export function getLilyPondTimingInfo() {
  return lilyPondTiming.getTimingInfo();
}

export function disableLilyPondTiming() {
  lilyPondTiming.disable();
}

// Default export
export default lilyPondTiming;