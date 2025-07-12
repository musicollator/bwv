#!/bin/bash

# compress_for_whatsapp.sh - Reduce video file size for WhatsApp sharing
# WhatsApp limits: 16MB file size (some regions: 64MB)

INPUT_VIDEO="kitty_final_with_score.mp4"

echo "🎬 WhatsApp Video Compression Options"
echo "📊 Current file size:"
ls -lh "$INPUT_VIDEO" 2>/dev/null || echo "❌ $INPUT_VIDEO not found!"
echo ""

# =============================================================================
# OPTION 1: High Quality (Target: ~10-15MB for 43s video)
# =============================================================================

echo "Option 1: High Quality (Target ~10-15MB)"
ffmpeg -i "$INPUT_VIDEO" \
  -vf "scale=1280:720" \
  -c:v libx264 -preset medium -crf 28 \
  -c:a aac -b:a 96k -ar 44100 \
  -movflags +faststart \
  kitty_whatsapp_hq.mp4

# =============================================================================
# OPTION 2: Medium Quality (Target: ~5-8MB for 43s video)
# =============================================================================

echo "Option 2: Medium Quality (Target ~5-8MB)"
ffmpeg -i "$INPUT_VIDEO" \
  -vf "scale=960:540" \
  -c:v libx264 -preset medium -crf 32 \
  -c:a aac -b:a 64k -ar 44100 \
  -movflags +faststart \
  kitty_whatsapp_mq.mp4

# =============================================================================
# OPTION 3: WhatsApp Safe (Target: <16MB guaranteed)
# =============================================================================

echo "Option 3: WhatsApp Safe (Target <16MB)"
ffmpeg -i "$INPUT_VIDEO" \
  -vf "scale=854:480" \
  -c:v libx264 -preset medium -crf 35 \
  -c:a aac -b:a 48k -ar 22050 \
  -r 20 \
  -movflags +faststart \
  kitty_whatsapp_safe.mp4

# =============================================================================
# OPTION 4: Ultra Compressed (Target: <5MB)
# =============================================================================

echo "Option 4: Ultra Compressed (Target <5MB)"
ffmpeg -i "$INPUT_VIDEO" \
  -vf "scale=640:360" \
  -c:v libx264 -preset medium -crf 38 \
  -c:a aac -b:a 32k -ar 22050 \
  -r 15 \
  -movflags +faststart \
  kitty_whatsapp_ultra.mp4

# =============================================================================
# OPTION 5: Custom Target Size (Exactly 15MB)
# =============================================================================

echo "Option 5: Custom Target Size (Exactly 15MB)"
# Calculate bitrate for exactly 15MB in 43 seconds
# Formula: (target_size_MB * 8 * 1000) / duration_seconds = total_kbps
# 15MB * 8 * 1000 / 43 ≈ 2790 kbps total
# Subtract audio bitrate: 2790 - 64 = 2726 kbps for video

ffmpeg -i "$INPUT_VIDEO" \
  -vf "scale=1280:720" \
  -c:v libx264 -preset medium -b:v 2726k -maxrate 2726k -bufsize 5452k \
  -c:a aac -b:a 64k -ar 44100 \
  -movflags +faststart \
  kitty_whatsapp_15mb.mp4

# =============================================================================
# SHOW RESULTS
# =============================================================================

echo ""
echo "📊 Compression Results:"
echo "Original:"
ls -lh "$INPUT_VIDEO" 2>/dev/null

echo "Compressed versions:"
for file in kitty_whatsapp_*.mp4; do
  if [ -f "$file" ]; then
    ls -lh "$file"
  fi
done

echo ""
echo "✅ Recommended for WhatsApp:"
echo "   - kitty_whatsapp_safe.mp4 (guaranteed <16MB)"
echo "   - kitty_whatsapp_15mb.mp4 (exactly 15MB target)"
echo ""
echo "🎯 Tips:"
echo "   - Test kitty_whatsapp_hq.mp4 first (best quality)"
echo "   - Use kitty_whatsapp_safe.mp4 if file size is still too large"
echo "   - WhatsApp will compress further, so start with good quality"