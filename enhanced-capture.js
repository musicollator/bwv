/**
 * Enhanced Puppeteer script with Web Animations API
 * Frame-perfect animations with precise timing control
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class EnhancedBachCapture {
  constructor(options = {}) {
    this.options = {
      width: 3840,
      height: 300,      // 1/6th height of 4K video (3840×2160) - perfect for 2 systems
      fps: 30,
      duration: 275.74,
      startTime: 0,
      outputDir: './frames2',
      videoOutput: './Kitty_animation.mp4',
      pageUrl: 'http://localhost:8000/?werk=Kitty',
      deviceScaleFactor: 2,    // Higher scale factor for crisp 4K rendering
      ...options
    };

    this.browser = null;
    this.page = null;
    this.totalFrames = Math.ceil(this.options.duration * this.options.fps);
  }

  async initialize() {
    console.log('🚀 Initializing Enhanced Bach animation capture...');

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Listen to console messages from the browser
    this.page.on('console', (msg) => {
      console.log('🖥️ Browser:', msg.text());
    });

    await this.page.setViewport({
      width: this.options.width,
      height: this.options.height,
      deviceScaleFactor: this.options.deviceScaleFactor
    });

    // Clean up and create output directory
    try {
      await fs.rm(this.options.outputDir, { recursive: true, force: true });
      console.log(`🗑️  Cleaned old frames from ${this.options.outputDir}`);
    } catch (error) {
      // Directory might not exist, that's fine
    }

    try {
      await fs.mkdir(this.options.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${this.options.outputDir}`);
    } catch (error) {
      throw new Error(`Could not create output directory: ${error.message}`);
    }

    console.log(`📐 Viewport: ${this.options.width}x${this.options.height}`);
    console.log(`🎬 Target: ${this.totalFrames} frames at ${this.options.fps}fps`);

    if (this.options.startTime > 0) {
      const startMin = Math.floor(this.options.startTime / 60);
      const startSec = (this.options.startTime % 60).toFixed(0);
      console.log(`⏰ Starting at: ${startMin}:${startSec.padStart(2, '0')} (${this.options.duration}s duration)`);
    }
  }

  async loadPage() {
    console.log('📄 Loading Bach player page...');

    await this.page.goto(this.options.pageUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for the SVG to be loaded
    await this.page.waitForSelector('#svg-container svg', { timeout: 30000 });
    console.log('✅ SVG loaded');

    // Wait for synchronisator to be ready
    await this.page.waitForFunction(() => window.sync !== null, { timeout: 30000 });
    console.log('✅ Synchronisator ready');


    // HIDE UI ELEMENTS and DISABLE CSS ANIMATIONS
    await this.page.addStyleTag({
      content: `
        /* Hide all UI elements for clean capture */
        .fixed-top { display: none !important; }
        #header { display: none !important; }
        #bwv-navigation { display: none !important; }
        #audio { display: none !important; }
        #bar_spy { display: none !important; }
        #footer { display: none !important; }
        #button_scroll_to_top { display: none !important; }
        #measure-controls { display: none !important; }
        header, footer, nav { display: none !important; }
        .border-bottom { display: none !important; }
        .bg-light { display: none !important; }
        
        /* Clean layout */
        body { 
          padding: 0 !important; 
          margin: 0 !important;
          background: white !important;
        }
        
        .main-content { 
          padding: 0 !important; 
          margin: 0 !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
        }
        
        .container { 
          padding: 0 !important; 
          margin: 0 !important; 
          max-width: none !important;
          width: 100% !important;
        }
        
        #svg-container { 
          margin: 0 !important; 
          padding: 5px !important;      /* Minimal padding for 4K capture */
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          min-height: 100vh !important;
          width: 100% !important;
          background: rgba(255,255,255,0.9) !important; /* Semi-transparent white background */
        }
        
        /* Natural size SVG with full width */
        #svg-container > svg {
          width: 100% !important;
          max-width: none !important;
          height: auto !important;
          margin: 10px !important;
        }
        
        /* DISABLE ALL CSS ANIMATIONS - Web Animations API will control everything */
        #svg-container > svg path[data-ref] {
          transition: none !important;
          animation: none !important;
          transform: scale(1);
          transform-box: fill-box;
          transform-origin: center;
          stroke-width: 0;
          stroke-opacity: 0;
        }
        
        #svg-container > svg path[data-ref].active {
          transition: none !important;
          animation: none !important;
        }
        
        /* Disable all transitions globally */
        * {
          transition: none !important;
          animation: none !important;
        }
      `
    });

    // Inject channel2colour.js functions into the page via script tag
    await this.page.addScriptTag({
      path: './js/channel2colour.js',
      type: 'module'
    });

    // Initialize Web Animations API system
    await this.page.evaluate(() => {
      // Create animation manager
      window.animationManager = {
        animations: new Map(),

        // Animation configurations
        config: {
          flashDuration: 200,     // 0.2s flash
          scaleDuration: 150,     // 0.15s scale
          fadeDuration: 1500,     // 1.5s fade out
          maxBrightness: 5,       // Flash brightness peak
          activeScale: 1.125,     // Active note scale
          strokeWidth: 0.125,     // Active stroke width
          strokeOpacity: 0.667    // Active stroke opacity
        },

        // Channel color mapping (will be set after sync data is loaded)
        channelColorMap: null,
        
        // Get channel colors using intelligent mapping
        getChannelColors: (channel) => {
          if (!window.animationManager.channelColorMap) {
            throw new Error(`Channel color mapping not initialized! Cannot get colors for channel ${channel}`);
          }
          
          // Use intelligent mapping
          const colorIndex = window.animationManager.channelColorMap.get(channel);
          if (colorIndex === undefined) {
            throw new Error(`Channel ${channel} not found in color mapping! Available channels: ${Array.from(window.animationManager.channelColorMap.keys())}`);
          }
          
          const colorInfo = window.animationManager.getColorFromIndex(colorIndex);
          if (!colorInfo) {
            throw new Error(`No color info found for color index ${colorIndex}`);
          }
          
          // Debug logging
          // console.log(`🎨 Channel ${channel} → Color Index ${colorIndex} → ${colorInfo.colorName} (${colorInfo.voice})`);
          
          return { fill: colorInfo.colorName, stroke: colorInfo.colorName };
        },
        
        // Get color from CSS using color index
        getColorFromIndex: (colorIndex) => {
          // Use the actual CSS color function if available
          if (!window.getActualCSSColor) {
            throw new Error('getActualCSSColor function not available! Channel color mapping failed to initialize.');
          }
          
          const colorInfo = window.getActualCSSColor(colorIndex);
          if (!colorInfo) {
            throw new Error(`No color information found for color index ${colorIndex}`);
          }
          
          return colorInfo;
        },

        // Update all animations to specific time
        setTime: function (timeSeconds) {
          if (!window.sync || !window.sync.notes) return;

          // Clear all existing styles
          document.querySelectorAll('[data-ref]').forEach(el => {
            el.style.transform = 'scale(1)';
            el.style.filter = 'none';
            el.style.strokeWidth = '0';
            el.style.strokeOpacity = '0';
            el.style.fill = '';
            el.style.stroke = '';
            el.style.opacity = 1; // Reset opacity too
          });

          // Apply animations for each note
          window.sync.notes.forEach(note => {
            if (note.elements && note.elements.length > 0) {
              this.updateNoteAnimation(note, timeSeconds);
            }
          });
        },

        // Update animation for a single note
        updateNoteAnimation: function (note, currentTime) {
          const visualTime = currentTime + (window.sync.visualLeadTime || 0);
          const noteStartTime = note.startTime;
          const noteEndTime = note.endTime;
          const colors = this.getChannelColors(note.channel);

          note.elements.forEach(element => {
            if (visualTime >= noteStartTime && visualTime <= noteEndTime) {
              // Note is currently active
              this.applyActiveAnimation(element, visualTime - noteStartTime, colors);

            } else if (visualTime > noteEndTime) {
              // Note has ended - apply fade out
              const fadeProgress = (visualTime - noteEndTime) / (this.config.fadeDuration / 1000);
              if (fadeProgress < 1) {
                this.applyFadeAnimation(element, fadeProgress, colors);
              }
              // If fadeProgress >= 1, element stays at default (already cleared above)
            }
            // If visualTime < noteStartTime, element stays at default
          });
        },

        // Apply active note animation (flash + scale)
        applyActiveAnimation: function (element, noteAge, colors) {
          const flashProgress = Math.min(noteAge / (this.config.flashDuration / 1000), 1);
          const scaleProgress = Math.min(noteAge / (this.config.scaleDuration / 1000), 1);

          // SMOOTH FLASH: brightness decreases smoothly from 5 to 1
          const brightness = this.config.maxBrightness - (this.config.maxBrightness - 1) * flashProgress;

          // Scale effect: grows from 1 to 1.125
          const scale = 1 + (this.config.activeScale - 1) * scaleProgress;

          // Stroke effect: fades in
          const strokeOpacity = this.config.strokeOpacity * scaleProgress;

          // Apply styles with full color (no opacity manipulation)
          element.style.fill = colors.fill;
          element.style.stroke = colors.stroke;
          element.style.filter = `brightness(${brightness})`;
          element.style.transform = `scale(${scale})`;
          element.style.strokeWidth = this.config.strokeWidth;
          element.style.strokeOpacity = strokeOpacity;
          element.style.opacity = 1; // Always full opacity
        },

        // Color interpolation helper
        interpolateColor: function (color1, color2, progress) {
          // Convert color names to RGB values
          const getColorRGB = (colorName) => {
            // Try to get actual computed color from CSS
            const tempEl = document.createElement('div');
            tempEl.style.color = colorName;
            document.body.appendChild(tempEl);
            const computedColor = getComputedStyle(tempEl).color;
            document.body.removeChild(tempEl);
            
            // Parse RGB values from computed color
            const match = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
              return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
            }
            
            // Fallback to hardcoded values
            const colorMap = {
              'coral': [255, 127, 80],
              'lightgreen': [144, 238, 144],
              'dodgerblue': [30, 144, 255],
              'gold': [255, 215, 0],
              'darkred': [139, 0, 0],
              'orchid': [218, 112, 214],
              'black': [0, 0, 0]
            };
            return colorMap[colorName] || [0, 0, 0];
          };

          const rgb1 = getColorRGB(color1);
          const rgb2 = getColorRGB(color2);

          const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * progress);
          const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * progress);
          const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * progress);

          return `rgb(${r}, ${g}, ${b})`;
        },

        // Apply fade out animation  
        applyFadeAnimation: function (element, fadeProgress, colors) {
          const scale = this.config.activeScale - (this.config.activeScale - 1) * fadeProgress;
          const strokeOpacity = this.config.strokeOpacity * (1 - fadeProgress);

          // CORRECT FADE: Color interpolation from active color to black
          const fadedFillColor = this.interpolateColor(colors.fill, 'black', fadeProgress);
          const fadedStrokeColor = this.interpolateColor(colors.stroke, 'black', fadeProgress);

          element.style.fill = fadedFillColor;
          element.style.stroke = fadedStrokeColor;
          element.style.filter = 'brightness(1)'; // Keep brightness normal
          element.style.transform = `scale(${scale})`;
          element.style.strokeWidth = this.config.strokeWidth;
          element.style.strokeOpacity = strokeOpacity;
          element.style.opacity = 1; // Keep full opacity, color does the fading
        }
      };

      console.log('🎭 Web Animations API manager initialized');
    });

    // Initialize intelligent channel color mapping
    await this.page.evaluate(async () => {
      if (window.sync && window.sync.syncData && window.sync.syncData.meta && window.sync.syncData.meta.channels) {
        // console.log('🔍 Checking sync data structure...');
        // console.log('  Total notes:', window.sync.notes.length);
        // console.log('  Channel metadata:', JSON.stringify(window.sync.syncData.meta.channels, null, 2));
        
        // Extract note data for intelligent mapping using the same method as synchronisator
        const channelData = [];
        
        for (const [channelStr, stats] of Object.entries(window.sync.syncData.meta.channels)) {
          const channel = parseInt(channelStr);
          
          // Create mock note data with pitch info distributed across the range
          for (let i = 0; i < stats.count; i++) {
            channelData.push({
              channel: channel,
              pitch: stats.minPitch + (i / stats.count) * (stats.maxPitch - stats.minPitch)
            });
          }
        }

        // console.log('  Processed channel data sample:', JSON.stringify(channelData.slice(0, 10), null, 2));
        
        // Import functions from the module
        try {
          const { createChannelColorMapping, logChannelMapping, getActualCSSColor } = await import('./js/channel2colour.js');
          
          // console.log('✅ Successfully imported channel2colour functions');
          
          // Create intelligent channel color mapping
          window.animationManager.channelColorMap = createChannelColorMapping(channelData);
          
          // Store the functions on window for later use
          window.createChannelColorMapping = createChannelColorMapping;
          window.logChannelMapping = logChannelMapping;
          window.getActualCSSColor = getActualCSSColor;
          
          // Debug: Log the mapping details
          // console.log('🎨 Channel Color Mapping Created:');
          // console.log('  Total channel data points:', channelData.length);
          // console.log('  Channel mapping:', JSON.stringify(Array.from(window.animationManager.channelColorMap.entries())));
          
          // Log the mapping for debugging
          // logChannelMapping(window.animationManager.channelColorMap, channelData);
          
          console.log('🎨 Intelligent channel color mapping initialized');
        } catch (error) {
          console.error('❌ Failed to import channel2colour functions:', error);
        }
      } else {
        console.error('❌ No sync data available for color mapping');
      }
    });

    // Set up capture environment
    await this.page.evaluate(() => {
      if (window.audio) {
        window.audio.pause();
        window.audio.currentTime = 0;
      }

      // Convert container to container-fluid for full width
      const containers = document.querySelectorAll('.container');
      containers.forEach(container => {
        container.classList.remove('container');
        container.classList.add('container-fluid');
      });

      console.log('📸 Enhanced capture with Web Animations API control');
      console.log('🎼 Animation features: Flash, Scale, Trailing fade');
      console.log('📏 Layout: Full-width natural size for 4K overlay');

      if (window.sync) {
        const stats = window.sync.getStats();
        console.log('- Total notes available:', window.sync.notes?.length || 0);
      }

      const svg = document.querySelector('#svg-container svg');
      if (svg) {
        const rect = svg.getBoundingClientRect();
        console.log(`- SVG size: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`);
      }
    });

    console.log('✅ Page configured for enhanced capture');
  }

  async captureFrame(frameNumber) {
    const relativeTime = frameNumber / this.options.fps;
    const absoluteTime = this.options.startTime + relativeTime;

    // Update synchronisator and apply Web Animations API control
    await this.page.evaluate((time, frameNum, relTime) => {
      if (window.sync) {
        const body = document.querySelector('body');
        if (body) {
          body.classList.add('playing');
        }

        window.sync.isPlaying = true;

        // Update sync system (for bar tracking, etc.)
        if (typeof window.sync.updateVisualSync === 'function') {
          window.sync.updateVisualSync(time);
        }

        // PRECISE ANIMATION CONTROL: Apply Web Animations API at exact time
        if (window.animationManager) {
          window.animationManager.setTime(time);
        }

        // Smart scrolling - natural size content
        if (typeof window.sync.getCurrentBar === 'function') {
          const visualTime = time + (window.sync.visualLeadTime || 0);
          const currentBar = window.sync.getCurrentBar(visualTime);

          if (currentBar && currentBar > 0) {
            const barElement = document.querySelector(`[data-bar="${currentBar}"]`);
            if (barElement) {
              const rect = barElement.getBoundingClientRect();
              const viewportHeight = window.innerHeight; // 300px

              // Smart scrolling - more stable for compact overlay
              if (typeof window.sync.getCurrentBar === 'function') {
                const visualTime = time + (window.sync.visualLeadTime || 0);
                const currentBar = window.sync.getCurrentBar(visualTime);

                if (currentBar && currentBar > 0) {
                  const barElement = document.querySelector(`[data-bar="${currentBar}"]`);
                  if (barElement) {
                    const rect = barElement.getBoundingClientRect();
                    const viewportHeight = window.innerHeight; // 300px

                    // More conservative scroll triggering - only when really needed
                    const isAboveView = rect.top < viewportHeight * 0.1;  // Top 10%
                    const isBelowView = rect.bottom > viewportHeight * 0.9; // Bottom 10%

                    if (isAboveView || isBelowView) {
                      // Center the bar more gently
                      const targetScrollY = window.scrollY + rect.top - (viewportHeight * 0.4);

                      // Prevent negative scroll AND validate the target makes sense
                      if (targetScrollY >= 0 && Math.abs(targetScrollY - window.scrollY) > 20) {
                        window.scrollTo({
                          top: targetScrollY,
                          behavior: 'auto'
                        });

                        if (frameNum % 60 === 0) {
                          console.log(`📜 Smooth scroll: Bar ${currentBar} at ${targetScrollY.toFixed(0)}px`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Progress logging
        if (frameNum % 60 === 0) {
          const visualTime = time + (window.sync.visualLeadTime || 0);
          const currentBar = window.sync.getCurrentBar ? window.sync.getCurrentBar(visualTime) : 'unknown';

          // Count active notes by checking actual styles
          const activeElements = document.querySelectorAll('[data-ref][style*="brightness"]');
          console.log(`⏱️ Frame ${frameNum}: ${relTime.toFixed(2)}s, Bar ${currentBar}, Animated: ${activeElements.length}`);
        }
      }
    }, absoluteTime, frameNumber, relativeTime);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Capture frame with PNG transparency
    const frameFileName = `frame_${frameNumber.toString().padStart(6, '0')}.png`;
    const framePath = path.join(this.options.outputDir, frameFileName);

    await this.page.screenshot({
      path: framePath,
      type: 'png',              // PNG for transparency support
      fullPage: false,
      captureBeyondViewport: false
    });

    return framePath;
  }

  async captureAll() {
    console.log('🎬 Starting enhanced Bach animation capture...');

    const startTime = Date.now();

    for (let frame = 0; frame < this.totalFrames; frame++) {
      const framePath = await this.captureFrame(frame);

      const progress = ((frame + 1) / this.totalFrames * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const eta = (((Date.now() - startTime) / (frame + 1)) * (this.totalFrames - frame - 1) / 1000).toFixed(1);

      if (frame % 60 === 0 || frame < 10) {
        console.log(`📸 Frame ${frame + 1}/${this.totalFrames} (${progress}%) - ${elapsed}s elapsed, ${eta}s ETA`);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Enhanced capture complete! ${this.totalFrames} frames in ${totalTime}s`);
  }

  async createVideo() {
    console.log('🎥 Creating video with FFmpeg...');

    const ffmpegCommand = [
      'ffmpeg',
      '-y',
      '-r', this.options.fps.toString(),
      '-i', `${this.options.outputDir}/frame_%06d.png`,  // PNG input
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', `fps=${this.options.fps}`,
      '-preset', 'medium',
      '-crf', '20',
      this.options.videoOutput
    ].join(' ');

    try {
      console.log(`Running: ${ffmpegCommand}`);
      execSync(ffmpegCommand, { stdio: 'inherit' });
      console.log(`✅ Enhanced video created: ${this.options.videoOutput}`);

      const stats = await fs.stat(this.options.videoOutput);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
      console.log(`📊 Video size: ${sizeMB}MB at ${this.options.fps}fps`);

    } catch (error) {
      console.error('❌ FFmpeg error:', error.message);
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.initialize();
      await this.loadPage();
      await this.captureAll();
      await this.createVideo();

      console.log('🎉 Enhanced Bach overlay capture complete!');
      console.log(`📁 Frames: ${this.options.outputDir}`);
      console.log(`🎥 Video: ${this.options.videoOutput}`);
      console.log(`📏 Format: Transparent PNG overlay (${this.options.width}x${this.options.height} - 4K compatible)`);
      console.log(`🔍 Scale: Natural size for optimal visibility`);
      console.log(`🎭 Features: Color fade, flash, scale animations`);

      if (this.options.fps === 60) {
        console.log(`\n🔗 Convert to 30fps first:`);
        console.log(`ffmpeg -i ${this.options.videoOutput} -vf "fps=30" -c:v libx264 -crf 20 bach_overlay_30fps.mp4`);

        console.log(`\n🎬 Overlay on your 4K performance video (3840×2160):`);
        console.log(`# Bottom overlay with 80% opacity:`);
        console.log(`ffmpeg -i final_performance.mp4 -i bach_overlay_30fps.mp4 \\`);
        console.log(`  -filter_complex "[1:v]format=yuva420p,colorchannelmixer=aa=0.8[score]; [0:v][score]overlay=0:H-h-20" \\`);
        console.log(`  -c:a copy performance_with_score.mp4`);

        console.log(`\n# Center overlay with 90% opacity:`);
        console.log(`ffmpeg -i final_performance.mp4 -i bach_overlay_30fps.mp4 \\`);
        console.log(`  -filter_complex "[1:v]format=yuva420p,colorchannelmixer=aa=0.9[score]; [0:v][score]overlay=0:(H-h)/2" \\`);
        console.log(`  -c:a copy performance_with_score_center.mp4`);

        console.log(`\n# With sync delay and custom opacity:`);
        console.log(`ffmpeg -i final_performance.mp4 -i bach_overlay_30fps.mp4 \\`);
        console.log(`  -filter_complex "[1:v]setpts=PTS+2.137/TB,format=yuva420p,colorchannelmixer=aa=0.85[score]; [0:v][score]overlay=0:H-h-20" \\`);
        console.log(`  -c:a copy performance_with_score_synced.mp4`);
      }

    } catch (error) {
      console.error('❌ Enhanced capture failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Usage
async function main() {
  const testMode = false; // Change to false for full capture

  const capture = new EnhancedBachCapture({
    width: 1920,
    height: 340,        // 4K width, 1/6th height for perfect overlay match
    fps: 30,
    duration: testMode ? 5 : 43,
    startTime: testMode ? 27 : 0,
    pageUrl: 'http://localhost:8000/?werk=Kitty',
    outputDir: testMode ? './test_frames_overlay' : './bach_frames_overlay',
    videoOutput: testMode ? './test_kitty_overlay.mp4' : './kitty_overlay.mp4'
  });

  if (testMode) {
    console.log('🧪 TEST MODE: 4K score overlay with transparency');
    console.log('   📏 Resolution: 3840x300 (4K width, 1/4th height)');
    console.log('   🎬 FPS: 30fps (efficient for overlay)');
    console.log('   🔍 Scale: Natural size (no scaling)');
    console.log('   📐 Layout: Full-width container-fluid');
    console.log('   🎭 Features: Color fade, flash, scale animations');
    console.log('   🖼️  Format: PNG with transparent background');
    console.log('   📜 Scrolling: Optimized for scaled content');
    console.log('   🎯 Result: Large, crisp 4K video overlay (3840×2160)');
    console.log('   Set testMode = false for full capture');
  }

  await capture.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EnhancedBachCapture };