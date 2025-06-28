/**
 * Complete Puppeteer script for Bach animation capture
 * Fast full-page capture with hidden UI elements and JPEG compression
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class SimpleBachCapture {
  constructor(options = {}) {
    this.options = {
      width: 1280,
      height: 720,
      fps: 60,
      duration: 275.74, // Duration from your video (4:35.74)
      startTime: 0,      // Start offset in seconds (for test mode)
      outputDir: './frames',
      videoOutput: './bach_animation.mp4',
      pageUrl: 'http://localhost:8000/?werk=1006', // Adjust as needed
      deviceScaleFactor: 1,
      ...options
    };

    this.browser = null;
    this.page = null;
    this.totalFrames = Math.ceil(this.options.duration * this.options.fps);
  }

  async initialize() {
    console.log('🚀 Initializing Bach animation capture...');

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

    // HIDE UI ELEMENTS for clean full-page capture
    await this.page.addStyleTag({
      content: `
        /* Hide specific UI elements - be more aggressive */
        .fixed-top { display: none !important; } /* Header with navigation and audio */
        #header { display: none !important; } /* Header container */
        #bwv-navigation { display: none !important; } /* BWV tabs */
        #audio { display: none !important; } /* Audio player */
        #bar_spy { display: none !important; } /* Bar counter */
        #footer { display: none !important; } /* Footer */
        #button_scroll_to_top { display: none !important; } /* Scroll button */
        #measure-controls { display: none !important; } /* Any controls */
        
        /* Hide any remaining header/footer elements */
        header, footer, nav { display: none !important; }
        .border-bottom { display: none !important; }
        .bg-light { display: none !important; }
        
        /* Remove body padding and margins */
        body { 
          padding: 0 !important; 
          margin: 0 !important;
          background: white !important;
        }
        
        /* Make main content fill entire viewport */
        .main-content { 
          padding: 0 !important; 
          margin: 0 !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
        }
        
        /* Make container fill the space */
        .container { 
          padding: 0 !important; 
          margin: 0 !important; 
          max-width: none !important;
          width: 100% !important;
        }
        
        /* Center and size SVG container */
        #svg-container { 
          margin: 0 !important; 
          padding: 20px !important;
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          min-height: 100vh !important;
        }
        
        /* Faster animations */
        #svg-container > svg path[data-ref] {
          transition: fill 0.05s linear, transform 0.05s linear, 
                      stroke 0.05s linear, stroke-width 0.05s linear, 
                      stroke-opacity 0.05s linear, filter 0.05s linear !important;
        }
        
        @keyframes noteFlash {
          0% { filter: brightness(3) saturate(0.3); }
          100% { filter: brightness(1) saturate(1); }
        }
        
        #svg-container > svg path[data-ref].active {
          animation: noteFlash 0.05s ease-out !important;
          transition: fill 0.05s linear, transform 0.05s linear, 
                      stroke 0.05s linear, stroke-width 0.05s linear, 
                      stroke-opacity 0.05s linear !important;
        }
        
        /* Disable slow transitions globally */
        * {
          transition-duration: 0.05s !important;
        }
      `
    });

    // Set up capture-friendly environment with controlled scrolling
    await this.page.evaluate(() => {
      // Pause any auto-play
      if (window.audio) {
        window.audio.pause();
        window.audio.currentTime = 0;
      }

      console.log('📸 Fast full-page capture with hidden UI and controlled scrolling');

      // Log system state
      console.log('🎼 Bach player capture setup:');
      console.log('- Audio element:', !!window.audio);
      console.log('- Sync system:', !!window.sync);
      console.log('- CONFIG loaded:', !!window.CONFIG);

      if (window.sync) {
        const stats = window.sync.getStats();
        console.log('- Sync stats:', stats);
        console.log('- Total notes available:', window.sync.notes?.length || 0);
        console.log('- Visual lead time:', window.sync.visualLeadTime || 0);
      }

      // Check SVG element
      const svg = document.querySelector('#svg-container svg');
      if (svg) {
        const rect = svg.getBoundingClientRect();
        console.log(`- SVG size: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`);
        console.log(`- Viewport: 1280x720 (UI hidden, SVG-focused)`);
      } else {
        console.error('❌ SVG element not found!');
      }
    });

    console.log('✅ Page configured for fast capture');
  }

  async captureFrame(frameNumber) {
    const relativeTime = frameNumber / this.options.fps;
    const absoluteTime = this.options.startTime + relativeTime;

    // Control the synchronisator and add smart scrolling
    await this.page.evaluate((time, frameNum, relTime) => {
      if (window.sync) {
        // Enable playing state for CSS styling
        const body = document.querySelector('body');
        if (body) {
          body.classList.add('playing');
        }

        window.sync.isPlaying = true;

        // Update visual sync
        if (typeof window.sync.updateVisualSync === 'function') {
          window.sync.updateVisualSync(time);
        } else {
          // Fallback: manually update highlights
          window.sync.clearAllHighlights();
          const visualTime = time + (window.sync.visualLeadTime || 0);
          
          if (window.sync.notes) {
            window.sync.notes.forEach(note => {
              if (note.startTime <= visualTime && note.endTime > visualTime) {
                window.sync.highlightNote(note);
              }
            });
          }
          
          if (typeof window.sync.getCurrentBar === 'function') {
            const currentBar = window.sync.getCurrentBar(visualTime);
            if (typeof window.sync.showBar === 'function') {
              window.sync.showBar(currentBar);
            }
          }
        }

        // SMART SCROLLING: Follow the music as it progresses
        if (typeof window.sync.getCurrentBar === 'function') {
          const visualTime = time + (window.sync.visualLeadTime || 0);
          const currentBar = window.sync.getCurrentBar(visualTime);
          
          if (currentBar && currentBar > 0) {
            // Find the current bar element
            const barElement = document.querySelector(`[data-bar="${currentBar}"]`);
            if (barElement) {
              const rect = barElement.getBoundingClientRect();
              const viewportHeight = window.innerHeight;
              
              // If current bar is near the bottom 30% of viewport, scroll down
              if (rect.top > viewportHeight * 0.7) {
                const scrollAmount = viewportHeight * 0.4; // Scroll by 40% of viewport
                window.scrollTo({
                  top: window.scrollY + scrollAmount,
                  behavior: 'auto' // Instant scroll for capture
                });
                
                if (frameNum % 60 === 0) {
                  console.log(`📜 Scrolled to follow bar ${currentBar}`);
                }
              }
            }
          }
        }

        // Log progress every 60 frames (for 60fps)
        if (frameNum % 60 === 0) {
          const visualTime = time + (window.sync.visualLeadTime || 0);
          const currentBar = window.sync.getCurrentBar ? window.sync.getCurrentBar(visualTime) : 'unknown';
          const activeNoteCount = window.sync.activeNotes?.length || 0;
          const totalNotes = window.sync.notes?.length || 0;
          console.log(`⏱️ Frame ${frameNum}: ${relTime.toFixed(2)}s, Bar ${currentBar}, Active: ${activeNoteCount}/${totalNotes}`);
        }
      }
    }, absoluteTime, frameNumber, relativeTime);

    await new Promise(resolve => setTimeout(resolve, 50));

    // FAST APPROACH: Simple full-page capture with JPEG compression
    const frameFileName = `frame_${frameNumber.toString().padStart(6, '0')}.jpg`;
    const framePath = path.join(this.options.outputDir, frameFileName);

    await this.page.screenshot({
      path: framePath,
      type: 'jpeg',
      quality: 90,
      fullPage: false,
      captureBeyondViewport: false
    });

    return framePath;
  }

  async captureAll() {
    console.log('🎬 Starting Bach animation capture...');

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
    console.log(`✅ Capture complete! ${this.totalFrames} frames in ${totalTime}s`);
  }

  async createVideo() {
    console.log('🎥 Creating video with FFmpeg...');

    const ffmpegCommand = [
      'ffmpeg',
      '-y',
      '-r', this.options.fps.toString(),
      '-i', `${this.options.outputDir}/frame_%06d.jpg`,
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
      console.log(`✅ Video created: ${this.options.videoOutput}`);

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

      console.log('🎉 Bach animation capture complete!');
      console.log(`📁 Frames: ${this.options.outputDir}`);
      console.log(`🎥 Video: ${this.options.videoOutput}`);
      
      if (this.options.fps === 60) {
        console.log(`\n🔗 Convert to 30fps for merging with your 29.97fps video:`);
        console.log(`ffmpeg -i ${this.options.videoOutput} -vf "fps=30" -c:v libx264 -crf 20 bach_30fps.mp4`);
        console.log(`\n🎬 Then merge:`);
        console.log(`ffmpeg -i final_performance.mp4 -i bach_30fps.mp4 -filter_complex "[0:v]scale=1920:1080[v1]; [1:v]scale=1920:1080[v2]; [v1][v2]hstack" -c:a copy merged_output.mp4`);
      } else {
        console.log(`\n🎬 Merge with your performance video:`);
        console.log(`ffmpeg -i final_performance.mp4 -i ${this.options.videoOutput} -filter_complex "[0:v]scale=1920:1080[v1]; [1:v]scale=1920:1080[v2]; [v1][v2]hstack" -c:a copy merged_output.mp4`);
      }

    } catch (error) {
      console.error('❌ Capture failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Usage with test mode
async function main() {
  // TEST MODE - captures just 10 seconds starting from the beginning
  const testMode = false; // Change to false for full capture

  const capture = new SimpleBachCapture({
    width: 1280,
    height: 720,
    fps: 60,
    duration: testMode ? 10 : 275.74,
    startTime: testMode ? 0 : 0,
    pageUrl: 'http://localhost:8000/?werk=1006',
    outputDir: testMode ? './test_frames' : './bach_frames',
    videoOutput: testMode ? './test_bach_clean.mp4' : './bach_animation.mp4'
  });

  if (testMode) {
    console.log('🧪 TEST MODE: Capturing 10 seconds with clean UI');
    console.log('   Resolution: 1280x720 (UI hidden, SVG centered)');
    console.log('   Format: JPEG (faster compression)');
    console.log('   Scrolling: Auto-follows the music');
    console.log('   Speed: ~70-100s (fast!)');
    console.log('   Set testMode = false for full capture');
  }

  await capture.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SimpleBachCapture };