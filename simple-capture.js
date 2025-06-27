/**
 * Simple Puppeteer script for your existing CSS animation system
 * No Web Animations API required - works with your current setup
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class SimpleBachCapture {
  constructor(options = {}) {
    this.options = {
      width: 3840,
      height: 2160,
      fps: 30,
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
        '--autoplay-policy=no-user-gesture-required' // Allow audio
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

    // Optional: Make CSS animations more deterministic and faster for capture
    await this.page.addStyleTag({
      content: `
        /* Faster, more deterministic animations for smoother capture */
        #svg-container > svg path[data-ref] {
          transition: fill 0.05s linear, transform 0.05s linear, 
                      stroke 0.05s linear, stroke-width 0.05s linear, 
                      stroke-opacity 0.05s linear, filter 0.05s linear !important;
        }
        
        @keyframes noteFlash {
          0% { filter: brightness(3) saturate(0.3); }
          100% { filter: brightness(1) saturate(1); }
        }
        
        /* Faster animations for smoother capture */
        @media (min-width: 1025px) and (hover: hover) and (pointer: fine) {
          #svg-container > svg path[data-ref].active {
            animation: noteFlash 0.05s ease-out !important;
            transition: fill 0.05s linear, transform 0.05s linear, 
                        stroke 0.05s linear, stroke-width 0.05s linear, 
                        stroke-opacity 0.05s linear !important;
          }
        }
        
        /* Disable any remaining slow transitions */
        * {
          transition-duration: 0.05s !important;
        }
        
        /* Keep basic UI transitions normal */
        button, .btn, select, input, .badge {
          transition-duration: 0.2s !important;
        }
      `
    });

    // Set up capture-friendly environment
    await this.page.evaluate(() => {
      // Pause any auto-play
      if (window.audio) {
        window.audio.pause();
        window.audio.currentTime = 0;
      }

      console.log('📸 Smart SVG cropping mode - follows current bar automatically');

      // Log system state for debugging
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

      // Check SVG element and log its real size
      const svg = document.querySelector('#svg-container svg');
      if (svg) {
        const rect = svg.getBoundingClientRect();
        console.log(`- Full SVG size: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`);
        console.log(`- Will crop to: ~${rect.width.toFixed(0)}x600px following the music`);
      } else {
        console.error('❌ SVG element not found!');
      }
    });

    console.log('✅ Page configured for capture');
  }

  async captureFrame(frameNumber) {
    const relativeTime = frameNumber / this.options.fps;
    const absoluteTime = this.options.startTime + relativeTime;

    // Directly control the synchronisator for this exact time
    await this.page.evaluate((time, frameNum, relTime) => {
      if (window.sync) {
        const body = document.querySelector('body');
        if (body) {
          body.classList.add('playing');
        }

        window.sync.isPlaying = true;

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

    const frameFileName = `frame_${frameNumber.toString().padStart(6, '0')}.png`;
    const framePath = path.join(this.options.outputDir, frameFileName);

    // FAST APPROACH: Get SVG info and smart crop in one call
    const cropInfo = await this.page.evaluate(() => {
      const svg = document.querySelector('#svg-container svg');
      if (!svg) return null;

      const svgRect = svg.getBoundingClientRect();
      
      // Find currently visible/active bar for smart cropping
      const visibleBar = document.querySelector('[data-bar][style*="visible"]') || 
                         document.querySelector('[data-bar]'); // Fallback to any bar

      let cropY = 0;
      const cropHeight = 600; // Show ~4-5 lines of music

      if (visibleBar) {
        const barRect = visibleBar.getBoundingClientRect();
        const relativeBarY = barRect.top - svgRect.top;
        // Center the crop around the current bar
        cropY = Math.max(0, Math.min(relativeBarY - 200, svgRect.height - cropHeight));
      }

      return {
        svgX: svgRect.left,
        svgY: svgRect.top,
        svgWidth: svgRect.width,
        svgHeight: svgRect.height,
        cropX: svgRect.left,
        cropY: svgRect.top + cropY,
        cropWidth: svgRect.width,
        cropHeight: Math.min(cropHeight, svgRect.height)
      };
    });

    if (!cropInfo) {
      throw new Error(`SVG element not found at frame ${frameNumber}`);
    }

    // Capture just the cropped section (much faster than full SVG)
    await this.page.screenshot({
      path: framePath,
      type: 'png',
      clip: {
        x: cropInfo.cropX,
        y: cropInfo.cropY,
        width: cropInfo.cropWidth,
        height: cropInfo.cropHeight
      }
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

      if (frame % 30 === 0 || frame < 10) { // More frequent logging at start
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
      '-y', // Overwrite output
      '-r', this.options.fps.toString(),
      '-i', `${this.options.outputDir}/frame_%06d.png`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', `fps=${this.options.fps}`, // Match input fps
      '-preset', 'medium',
      '-crf', '20', // Better quality (was 23)
      this.options.videoOutput
    ].join(' ');

    try {
      console.log(`Running: ${ffmpegCommand}`);
      execSync(ffmpegCommand, { stdio: 'inherit' });
      console.log(`✅ Video created: ${this.options.videoOutput}`);

      // Show file size
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
      console.log(`\n🎵 Next step: Merge with your performance video:`);
      console.log(`ffmpeg -i final_performance.mp4 -i ${this.options.videoOutput} -filter_complex "[0:v]scale=1920:1080[v1]; [1:v]scale=1920:1080[v2]; [v1][v2]hstack" -c:a copy merged_output.mp4`);

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
  const testMode = true; // Change to false for full capture

  const capture = new SimpleBachCapture({
    width: 1280,      // Browser viewport (for loading)
    height: 720,      // Browser viewport (for loading)  
    fps: 60,          // Higher FPS for smoother animation
    duration: testMode ? 10 : 275.74, // 10 seconds for test, full duration for real
    startTime: testMode ? 0 : 0,       // Start from beginning
    pageUrl: 'http://localhost:8000/?werk=1006', // Adjust this URL
    outputDir: testMode ? './test_frames' : './bach_frames',
    videoOutput: testMode ? './test_bach_cropped.mp4' : './bach_animation.mp4'
  });

  if (testMode) {
    console.log('🧪 TEST MODE: Capturing 10 seconds - Smart SVG cropping');
    console.log('   Crop size: ~936x600px (follows the music)');
    console.log('   FPS: 60 (smoother animation)');
    console.log('   Content: Focused view that follows current bar');
    console.log('   This will take about 2-3 minutes');
    console.log('   Set testMode = false for full capture');
  }

  await capture.run();
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SimpleBachCapture };