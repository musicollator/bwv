// js/channel2colour.js - Reads voice colors from CSS (CSS is source of truth)
// Maps MIDI channels to colors based on pitch range rather than channel number

/**
 * Read voice color configuration from CSS custom properties
 * @returns {Array} Array of voice configurations
 */
function readVoiceColorsFromCSS() {
  const style = getComputedStyle(document.documentElement);
  const voices = [];
  
  // Read up to 10 voice definitions from CSS
  for (let i = 0; i < 10; i++) {
    const color = style.getPropertyValue(`--voice-${i}-color`).trim();
    const name = style.getPropertyValue(`--voice-${i}-name`).trim().replace(/['"]/g, '');
    const description = style.getPropertyValue(`--voice-${i}-description`).trim().replace(/['"]/g, '');
    
    // Stop when we find no more voice definitions
    if (!color) break;
    
    voices.push({
      color,
      voice: name || `VOICE${i + 1}`,
      description: description || 'additional voice'
    });
  }
  
  return voices;
}

/**
 * Get voice color configuration (lazy-loaded from CSS)
 * @returns {Array} Array of voice configurations
 */
export function getVoiceColors() {
  // Cache the result to avoid re-reading CSS every time
  if (!getVoiceColors._cache) {
    getVoiceColors._cache = readVoiceColorsFromCSS();
  }
  return getVoiceColors._cache;
}

/**
 * Derived color palette for backward compatibility
 */
export function getColorPalette() {
  return getVoiceColors().map(v => v.color);
}

/**
 * Create intelligent channel to color mapping based on pitch ranges
 * @param {Array} noteData - Raw note data with channel and pitch info
 * @returns {Map} channelColorMap - MIDI channel → color index mapping
 */
export function createChannelColorMapping(noteData) {
  // Calculate pitch range statistics for each channel
  const channelStats = new Map();
  
  noteData.forEach(note => {
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

  // Convert to array and calculate average pitch for each channel
  const channelsWithAvgPitch = Array.from(channelStats.entries()).map(([channel, stats]) => ({
    channel,
    stats,
    avgPitch: (stats.pitchRange.min + stats.pitchRange.max) / 2,
    pitchRange: stats.pitchRange.max - stats.pitchRange.min
  }));

  // Sort channels by average pitch (highest to lowest)
  channelsWithAvgPitch.sort((a, b) => b.avgPitch - a.avgPitch);

  // Create the mapping
  const channelColorMap = new Map();
  const voiceColors = getVoiceColors();
  
  if (channelsWithAvgPitch.length === 0) {
    return channelColorMap; // Empty mapping for no channels
  }
  
  if (channelsWithAvgPitch.length === 1) {
    // Single channel → first voice (soprano)
    channelColorMap.set(channelsWithAvgPitch[0].channel, 0);
  } else {
    // Multiple channels: highest → first voice, lowest → second voice, others → remaining
    const highestChannel = channelsWithAvgPitch[0];           // Highest pitch
    const lowestChannel = channelsWithAvgPitch[channelsWithAvgPitch.length - 1]; // Lowest pitch
    
    channelColorMap.set(highestChannel.channel, 0); // First voice (soprano)
    channelColorMap.set(lowestChannel.channel, 1);  // Second voice (bass)
    
    // Map remaining channels to voices 2, 3, 4, 5...
    let colorIndex = 2;
    for (let i = 1; i < channelsWithAvgPitch.length - 1; i++) {
      const channel = channelsWithAvgPitch[i].channel;
      channelColorMap.set(channel, Math.min(colorIndex, voiceColors.length - 1));
      colorIndex++;
    }
  }

  return channelColorMap;
}

/**
 * Get the actual computed CSS color for a channel
 * @param {number} colorIndex - The color index
 * @returns {object} Object with colorName, voice, description, and actualColor (hex)
 */
export function getActualCSSColor(colorIndex) {
  const voiceColors = getVoiceColors();
  const voiceInfo = voiceColors[colorIndex];
  
  if (!voiceInfo) {
    return {
      colorName: `color-${colorIndex}`,
      voice: `VOICE${colorIndex + 1}`,
      description: 'undefined voice',
      actualColor: '#000000'
    };
  }
  
  // Create a temporary element to get computed color
  const tempElement = document.createElement('div');
  tempElement.style.color = voiceInfo.color;
  document.body.appendChild(tempElement);
  
  const computedColor = window.getComputedStyle(tempElement).color;
  document.body.removeChild(tempElement);
  
  // Convert RGB to hex for better display
  const hexColor = rgbToHex(computedColor);
  
  return {
    colorName: voiceInfo.color,
    voice: voiceInfo.voice,
    description: voiceInfo.description,
    actualColor: hexColor || computedColor
  };
}

/**
 * Convert RGB color to hex format
 * @param {string} rgb - RGB color string like "rgb(255, 127, 80)"
 * @returns {string} Hex color like "#ff7f50"
 */
function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return null;
  
  const r = parseInt(result[0]);
  const g = parseInt(result[1]); 
  const b = parseInt(result[2]);
  
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Log channel mapping information with actual CSS colors
 * @param {Map} channelColorMap - The channel to color mapping
 * @param {Array} noteData - Raw note data for statistics
 */
export function logChannelMapping(channelColorMap, noteData) {
  // Recalculate stats for logging
  const channelStats = new Map();
  noteData.forEach(note => {
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

  // Sort channels by their assigned color index for logical display
  const sortedChannels = Array.from(channelColorMap.entries())
    .sort((a, b) => a[1] - b[1]); // Sort by color index

  // console.log('🎵 Intelligent MIDI Channel → Color Mapping (from CSS):');
  sortedChannels.forEach(([channel, colorIndex]) => {
    const stats = channelStats.get(channel);
    const { colorName, voice, actualColor } = getActualCSSColor(colorIndex);
    const avgPitch = ((stats.pitchRange.min + stats.pitchRange.max) / 2).toFixed(1);
    const pitchInfo = `pitch ${stats.pitchRange.min}-${stats.pitchRange.max} (avg: ${avgPitch})`;
    
    // console.log(`  Channel ${channel} → %c${colorName} ${actualColor}%c: ${stats.count} notes (${pitchInfo}) [${voice}]`, 
    //             `color: ${colorName}; font-weight: bold;`, 
    //             'color: inherit;');
  });
  
  const totalChannels = channelColorMap.size;
  const totalNotes = Array.from(channelStats.values()).reduce((sum, stats) => sum + stats.count, 0);
  // console.log(`🎼 Total: ${totalChannels} channels, ${totalNotes} notes`);
}

/**
 * Get color name for a given color index
 * @param {number} colorIndex - The color index
 * @returns {string} Color name
 */
export function getColorName(colorIndex) {
  const voiceColors = getVoiceColors();
  return voiceColors[colorIndex]?.color || `color-${colorIndex}`;
}

/**
 * Get voice name for a given color index
 * @param {number} colorIndex - The color index
 * @returns {string} Voice name
 */
export function getVoiceName(colorIndex) {
  const voiceColors = getVoiceColors();
  return voiceColors[colorIndex]?.voice || `VOICE${colorIndex + 1}`;
}