// js/bachSiegelAnimation.js - Quantized Bach Siegel Animation with Light-Refraction Physics
// Uses anime.js for smooth animations

class BachSiegelAnimation {
  constructor(animeJs, quantization = 8) {
    this.anime = animeJs;
    this.isLoading = false;
    this.currentAnimation = undefined;
    this.isWildMode = false;

    // Get DOM elements
    this.logoLeft = document.getElementById('logoLeft');
    this.logoRight = document.getElementById('logoRight');

    // Quantization setup - be lenient, round odd numbers to next even
    this.quantization = quantization % 2 === 0 ? quantization : quantization + 1;
    this.quantization = Math.max(2, this.quantization); // minimum Q=2

    // Generate quantized angles starting from 90°
    this.quantizedAngles = this._generateQuantizedAngles();

    // Circular animation parameters
    this.radius = 120; // vw units - distance from center to off-screen
    this.minSeparation = 90; // minimum degrees between seals
    this.refractionAngle = 90; // minimum angle to avoid acute bouncing (like light refraction)

    // Track where each seal came from (in degrees) - must be quantized!
    this.leftSealFromAngle = 180;   // Blue JSB starts from LEFT (270°)  
    this.rightSealFromAngle = 0;   // Gold BJS starts from RIGHT (90°)
    this.leftSealToAngle = null;
    this.rightSealToAngle = null;

    console.log(`🎼 Bach Siegel Quantized Animation initialized (Q=${this.quantization})`);
    console.log(`📐 Available angles: [${this.quantizedAngles.join('°, ')}°]`);
    console.log(`🌊 Light-refraction constraint: ${this.refractionAngle}° minimum`);
    console.log('Left element:', this.logoLeft ? '✅ Found' : '❌ Missing');
    console.log('Right element:', this.logoRight ? '✅ Found' : '❌ Missing');
    console.log('Anime.js:', this.anime ? '✅ Available' : '❌ Missing');
  }

  // Generate Q evenly-spaced angles starting from 90°
  _generateQuantizedAngles() {
    const step = 360 / this.quantization;
    const angles = [];
    for (let i = 0; i < this.quantization; i++) {
      angles.push((90 + i * step) % 360);
    }
    return angles.sort((a, b) => a - b);
  }

  // Get a random quantized angle
  _randomQuantizedAngle() {
    return this.quantizedAngles[Math.floor(Math.random() * this.quantizedAngles.length)];
  }

  // Update quantization level (useful for dynamic changes)
  setQuantization(newQ) {
    const oldQ = this.quantization;
    this.quantization = newQ % 2 === 0 ? newQ : newQ + 1;
    this.quantization = Math.max(2, this.quantization);
    this.quantizedAngles = this._generateQuantizedAngles();

    console.log(`📐 Quantization changed: Q=${oldQ} → Q=${this.quantization}`);
    console.log(`📐 New angles: [${this.quantizedAngles.join('°, ')}°]`);

    return this.quantization;
  }

  // Convert angle (degrees) to screen position
  _angleToPosition(angleDegrees) {
    const angleRadians = (angleDegrees * Math.PI) / 180;
    return {
      left: `${this.radius * Math.cos(angleRadians)}vw`,
      top: `${this.radius * Math.sin(angleRadians)}vw`
    };
  }

  // Check if two angles have minimum separation (handling wrap-around)
  _hasMinimumSeparation(angle1, angle2, minDegrees = this.minSeparation) {
    const diff = Math.abs(angle1 - angle2);
    const separation = Math.min(diff, 360 - diff);
    return separation >= minDegrees;
  }

  // Pick exit angles following the STRICT RELATIVE light-refraction rules
  _pickExitAngles() {
    // Calculate forbidden perpendicular directions RELATIVE to entry
    const leftForbiddenPerpendiculars = [
      (this.leftSealFromAngle + 90) % 360,   // perpendicular clockwise
      (this.leftSealFromAngle + 270) % 360   // perpendicular counter-clockwise
    ];

    const rightForbiddenPerpendiculars = [
      (this.rightSealFromAngle + 90) % 360,   // perpendicular clockwise  
      (this.rightSealFromAngle + 270) % 360   // perpendicular counter-clockwise
    ];

    // Left seal: ≥90° from entry + no perpendicular exits relative to entry
    const leftOptions = this.quantizedAngles.filter(angle =>
      this._hasMinimumSeparation(angle, this.leftSealFromAngle, this.refractionAngle) &&
      !leftForbiddenPerpendiculars.includes(angle)
    );

    if (leftOptions.length > 0) {
      this.leftSealToAngle = leftOptions[Math.floor(Math.random() * leftOptions.length)];
    } else {
      // Fallback: at least avoid acute bouncing (ignore perpendicular constraint if necessary)
      const fallbackOptions = this.quantizedAngles.filter(angle =>
        this._hasMinimumSeparation(angle, this.leftSealFromAngle, this.refractionAngle)
      );

      if (fallbackOptions.length > 0) {
        this.leftSealToAngle = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
        console.warn(`⚠️ Left seal: perpendicular constraint relaxed from ${this.leftSealFromAngle}°`);
      } else {
        this.leftSealToAngle = this._randomQuantizedAngle();
        console.warn(`⚠️ Left seal: all constraints relaxed from ${this.leftSealFromAngle}°`);
      }
    }

    // Right seal: ≥90° from entry + ≥90° from left + no perpendicular exits relative to entry
    const rightOptions = this.quantizedAngles.filter(angle =>
      this._hasMinimumSeparation(angle, this.rightSealFromAngle, this.refractionAngle) &&
      this._hasMinimumSeparation(angle, this.leftSealToAngle, this.minSeparation) &&
      !rightForbiddenPerpendiculars.includes(angle)
    );

    if (rightOptions.length > 0) {
      this.rightSealToAngle = rightOptions[Math.floor(Math.random() * rightOptions.length)];
    } else {
      // Fallback 1: at least avoid acute bouncing and maintain separation, ignore perpendicular constraint
      const fallback1Options = this.quantizedAngles.filter(angle =>
        this._hasMinimumSeparation(angle, this.rightSealFromAngle, this.refractionAngle) &&
        this._hasMinimumSeparation(angle, this.leftSealToAngle, this.minSeparation)
      );

      if (fallback1Options.length > 0) {
        this.rightSealToAngle = fallback1Options[Math.floor(Math.random() * fallback1Options.length)];
        console.warn(`⚠️ Right seal: perpendicular constraint relaxed from ${this.rightSealFromAngle}°`);
      } else {
        // Fallback 2: at least avoid acute bouncing, ignore both perpendicular and separation constraints
        const fallback2Options = this.quantizedAngles.filter(angle =>
          this._hasMinimumSeparation(angle, this.rightSealFromAngle, this.refractionAngle)
        );

        if (fallback2Options.length > 0) {
          this.rightSealToAngle = fallback2Options[Math.floor(Math.random() * fallback2Options.length)];
          console.warn(`⚠️ Right seal: perpendicular + separation constraints relaxed from ${this.rightSealFromAngle}°`);
        } else {
          // Last resort: completely random
          this.rightSealToAngle = this._randomQuantizedAngle();
          console.warn(`⚠️ Right seal: all constraints relaxed from ${this.rightSealFromAngle}°`);
        }
      }
    }

    console.log(`🚫 RELATIVE perpendicular refraction dance: Left ${this.leftSealFromAngle}°→${this.leftSealToAngle}°, Right ${this.rightSealFromAngle}°→${this.rightSealToAngle}°`);
    console.log(`   Left forbidden perpendiculars: ${leftForbiddenPerpendiculars}°`);
    console.log(`   Right forbidden perpendiculars: ${rightForbiddenPerpendiculars}°`);
    console.log(`   Left refraction: ${Math.min(Math.abs(this.leftSealToAngle - this.leftSealFromAngle), 360 - Math.abs(this.leftSealToAngle - this.leftSealFromAngle))}°`);
    console.log(`   Right refraction: ${Math.min(Math.abs(this.rightSealToAngle - this.rightSealFromAngle), 360 - Math.abs(this.rightSealToAngle - this.rightSealFromAngle))}°`);
    console.log(`   Seal separation: ${Math.min(Math.abs(this.leftSealToAngle - this.rightSealToAngle), 360 - Math.abs(this.leftSealToAngle - this.rightSealToAngle))}°`);
  }

  // Set initial positions and show elements
  _prepareElements() {
    if (!this.logoLeft || !this.logoRight) {
      console.warn('⚠️ Missing siegel elements');
      return false;
    }

    // Set starting positions using quantized angles
    this._setElementStyle(this.logoLeft, this._angleToPosition(this.leftSealFromAngle));
    this._setElementStyle(this.logoRight, this._angleToPosition(this.rightSealFromAngle));

    // Show elements
    this.logoLeft.style.display = 'inherit';
    this.logoRight.style.display = 'inherit';

    return true;
  }

  // Apply style object to element
  _setElementStyle(element, styleObj) {
    for (let key in styleObj) {
      element.style[key] = styleObj[key];
    }
  }

  // Hide elements 
  _hideElements() {
    if (this.logoLeft) this.logoLeft.style.display = 'none';
    if (this.logoRight) this.logoRight.style.display = 'none';
  }

  // Start the light-refraction quantized animation
  startWildDance() {
    if (this.isWildMode) {
      console.log('⚠️ Refraction dance already in progress');
      return Promise.resolve();
    }

    if (!this.anime) {
      console.error('❌ Anime.js not available');
      return Promise.reject(new Error('Anime.js required'));
    }

    console.log(`🌊 Starting light-refraction Bach siegel dance (Q=${this.quantization})...`);
    this.isWildMode = true;
    this.isLoading = true;

    // Prepare elements
    if (!this._prepareElements()) {
      this.isWildMode = false;
      this.isLoading = false;
      return Promise.reject(new Error('Missing DOM elements'));
    }

    // Start the eternal refraction dance
    this._danceStep();
    return Promise.resolve();
  }

  // Single dance step: come in → pause → go out → repeat
  _danceStep() {
    if (!this.isWildMode) return;

    // Pick where they'll exit to (with light-refraction constraints)
    this._pickExitAngles();

    // Step 1: Slide in from current positions to center
    this.currentAnimation = this.anime({
      targets: ['div#logoLeft', 'div#logoRight'],
      left: 0,  // CSS margins will center them
      top: 0,   // CSS margins will center them
      zIndex: [1, 2], // Left=1, Right=2 (blue on top)
      duration: 900,
      easing: 'easeOutQuad',
      complete: () => {
        if (!this.isWildMode) return;

        // Step 2: Brief pause in center (like light slowing in denser medium)
        setTimeout(() => {
          if (!this.isWildMode) return;

          // Step 3: Slide out to refracted directions
          const leftExitPos = this._angleToPosition(this.leftSealToAngle);
          const rightExitPos = this._angleToPosition(this.rightSealToAngle);

          this.currentAnimation = this.anime({
            targets: ['div#logoLeft'],
            left: leftExitPos.left,
            top: leftExitPos.top,
            zIndex: 1, // Keep gold underneath
            duration: 900,
            easing: 'easeInQuad'
          });

          this.anime({
            targets: ['div#logoRight'],
            left: rightExitPos.left,
            top: rightExitPos.top,
            zIndex: 2, // Keep blue on top
            duration: 900,
            easing: 'easeInQuad',
            complete: () => {
              if (!this.isWildMode) return;

              // Update positions: where they went becomes where they come from
              this.leftSealFromAngle = this.leftSealToAngle;
              this.rightSealFromAngle = this.rightSealToAngle;

              // Brief pause before next cycle
              setTimeout(() => {
                this._danceStep(); // Continue the eternal refraction dance!
              }, 400);
            }
          });
        }, 1000); // Brief center pause
      }
    });
  }

  // Stop the refraction dance
  stopWildDance() {
    if (!this.isWildMode) {
      console.log('⚠️ No refraction dance in progress');
      return Promise.resolve();
    }

    console.log('🌊 Stopping refraction dance...');
    this.isWildMode = false;

    // Stop current animation
    if (this.currentAnimation) {
      this.currentAnimation.pause();
    }

    // Hide elements and reset
    this._hideElements();
    this.isLoading = false;
    this.currentAnimation = undefined;

    // Reset positions for next time
    this.leftSealFromAngle = 90;   // left
    this.rightSealFromAngle = 270; // right

    console.log('✅ Refraction dance stopped');
    return Promise.resolve();
  }

  // Legacy methods for compatibility
  showLoading() {
    return this.startWildDance();
  }

  hideLoading() {
    return this.stopWildDance();
  }

  // Utility method for minimum loading time
  async loadWithMinimumDuration(loadingPromise, minimumMs = 2500) {
    await this.showLoading();

    const startTime = Date.now();

    try {
      const result = await loadingPromise;
      const elapsed = Date.now() - startTime;

      console.log(`⏱️ Loading took ${elapsed}ms, minimum is ${minimumMs}ms`);

      if (elapsed < minimumMs) {
        const waitTime = minimumMs - elapsed;
        console.log(`⏳ Waiting additional ${waitTime}ms for Bach drama...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      await this.hideLoading();
      return result;

    } catch (error) {
      console.error('❌ Loading error:', error);
      await this.hideLoading();
      throw error;
    }
  }

  // Force reset
  reset() {
    console.log('🔄 Force reset...');
    this.stopWildDance();
    console.log('🔄 Reset complete');
  }

  // Get current status
  getStatus() {
    return {
      isLoading: this.isLoading,
      isWildMode: this.isWildMode,
      quantization: this.quantization,
      quantizedAngles: this.quantizedAngles,
      refractionAngle: this.refractionAngle,
      hasAnime: !!this.anime,
      leftElement: !!this.logoLeft,
      rightElement: !!this.logoRight,
      // loadingElement: !!this.loadingDiv,
      currentAnimation: !!this.currentAnimation,
      leftSealFromAngle: this.leftSealFromAngle,
      rightSealFromAngle: this.rightSealFromAngle,
      leftSealToAngle: this.leftSealToAngle,
      rightSealToAngle: this.rightSealToAngle,
      radius: this.radius,
      minSeparation: this.minSeparation
    };
  }
}

// Factory function to create instance with anime.js
export function createBachSiegelAnimation(animeJs, quantization = 8) {
  return new BachSiegelAnimation(animeJs, quantization);
}

// Default export
export default BachSiegelAnimation;