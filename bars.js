// bars.js - LilyPond Timing Integration Module
// Provides accurate bar timing by calibrating LilyPond moments to real-time audio

class LilyPondTimingSystem {
  constructor() {
    this.timingData = null;
    this.isActive = false;
    this.originalGetCurrentBar = null;
  }

  /**
   * Extract LilyPond timing data from SVG attributes
   */
  extractTimings() {
    const barElements = document.querySelectorAll('[data-bar-moment-main]');
    if (barElements.length === 0) {
      console.log('No LilyPond timing data found in SVG');
      return null;
    }

    // Extract moments and bar numbers
    const timingData = [];
    barElements.forEach(element => {
      const barNumber = parseInt(element.getAttribute('data-bar'));
      const momentStr = element.getAttribute('data-bar-moment-main');
      
      if (!isNaN(barNumber) && momentStr) {
        timingData.push({
          bar: barNumber,
          moment: this.parseFraction(momentStr)
        });
      }
    });

    // Sort by moment and remove duplicates
    timingData.sort((a, b) => a.moment - b.moment);
    const uniqueTimings = [];
    let lastMoment = -Infinity;
    timingData.forEach(timing => {
      if (timing.moment !== lastMoment) {
        uniqueTimings.push(timing);
        lastMoment = timing.moment;
      }
    });

    console.log('Extracted LilyPond timings:', uniqueTimings);
    return uniqueTimings;
  }

  /**
   * Calibrate LilyPond moments to real-time seconds using MIDI data
   */
  calibrate(convertedNotes, totalDurationSeconds) {
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

    // Calculate LilyPond musical span
    const moments = lilypondTimings.map(t => t.moment);
    const minMoment = Math.min(...moments);
    const maxMoment = Math.max(...moments);
    const musicalSpanMoments = maxMoment - minMoment;

    // Derive conversion factor
    const secondsPerMomentUnit = musicalDurationSeconds / musicalSpanMoments;

    // Convert all moments to absolute seconds
    const barTimings = lilypondTimings.map(timing => ({
      bar: timing.bar,
      moment: timing.moment,
      seconds: musicStartSeconds + (timing.moment - minMoment) * secondsPerMomentUnit
    }));

    const result = {
      barTimings: barTimings,
      musicStartSeconds: musicStartSeconds,
      musicEndSeconds: musicEndSeconds,
      musicalDurationSeconds: musicalDurationSeconds,
      secondsPerMomentUnit: secondsPerMomentUnit,
      hasPreMusicSilence: musicStartSeconds > 0.05,
      hasPostMusicSilence: totalDurationSeconds - musicEndSeconds > 0.5
    };

    console.log('=== LilyPond Timing Calibration ===');
    console.log(`Music spans: ${musicStartSeconds.toFixed(3)}s to ${musicEndSeconds.toFixed(3)}s`);
    console.log(`LilyPond span: ${minMoment} to ${maxMoment} moments (${musicalSpanMoments} units)`);
    console.log(`Conversion rate: ${secondsPerMomentUnit.toFixed(3)}s per moment unit`);
    console.log('Bar timings:', barTimings.map(t => `Bar ${t.bar}: ${t.seconds.toFixed(3)}s`));
    console.log('=====================================');

    this.timingData = result;
    return result;
  }

  /**
   * Get current bar using LilyPond-calibrated timings
   */
  getCurrentBar(currentTime, fallbackFunction) {
    if (!this.isActive || !this.timingData) {
      return fallbackFunction(currentTime);
    }

    const { barTimings, musicStartSeconds, musicEndSeconds, hasPostMusicSilence } = this.timingData;

    // Handle pre-music time
    if (currentTime < musicStartSeconds) {
      return barTimings[0].bar; // First bar (might be pickup)
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
   * Initialize the LilyPond timing system
   */
  initialize(convertedNotes, totalDurationSeconds, getCurrentBarFunction) {
    console.log('Initializing LilyPond timing system...');
    
    // Store original function for fallback
    this.originalGetCurrentBar = getCurrentBarFunction;
    
    // Calibrate LilyPond moments to real time
    const calibrationResult = this.calibrate(convertedNotes, totalDurationSeconds);
    
    if (calibrationResult) {
      this.isActive = true;
      console.log('✅ LilyPond timing system active');
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
export function initializeLilyPondTiming(convertedNotes, totalDurationSeconds, getCurrentBarFunction) {
  return lilyPondTiming.initialize(convertedNotes, totalDurationSeconds, getCurrentBarFunction);
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