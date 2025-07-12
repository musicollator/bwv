#!/bin/bash

# unmess.sh - Clean, documented video overlay commands
# This script creates a video overlay of the musical score on top of the original performance video

# =============================================================================
# MAIN OVERLAY COMMAND - Bottom Aligned with Semi-Transparency
# =============================================================================

# Overlay kitty_overlay.mp4 on top of Kitty_original_from_youtube.mp4
# - Starts YouTube video at 2:58.370 (2 minutes 58.370 seconds)
# - Fixed duration: exactly 43 seconds (overlay duration)
# - Bottom alignment with 20px margin from bottom edge
# - 75% opacity (good balance between visibility and not overwhelming the performance)
# - Uses TrueKitty.mp3 audio instead of YouTube video audio
# - Scales overlay from 3840x680 to 1920x340 (maintains aspect ratio)
# - Fade to black: starts at 33s, duration 10s (last 10 seconds)

ffmpeg -ss 2:58.370 -i /Users/christophe.thiebaud/Kitty/video/Kitty_original_from_youtube.mp4 -i ../kitty_overlay.mp4 -i /Users/christophe.thiebaud/Kitty/exports/TrueKitty.mp3 \
  -filter_complex "
    [1:v]scale=1920:340,format=yuva420p,colorchannelmixer=aa=0.75[score]; 
    [0:v][score]overlay=0:H-h-20[overlaid];
    [overlaid]fade=t=out:st=33:d=10:color=black[video_out]
  " \
  -map "[video_out]" -map "2:a" -t 43 -c:v libx264 -c:a aac kitty_final_with_score.mp4

# =============================================================================
# ALTERNATIVE OPTIONS (commented out - uncomment to use)
# =============================================================================

# Option 1: Higher opacity (90% - more visible score)
# ffmpeg -ss 2:58.370 -i /Users/christophe.thiebaud/Kitty/video/Kitty_original_from_youtube.mp4 -i ../kitty_overlay.mp4 \
#   -filter_complex "[1:v]scale=1920:340,format=yuva420p,colorchannelmixer=aa=0.9[score]; [0:v][score]overlay=0:H-h-20" \
#   -c:a copy -shortest kitty_final_with_score_90.mp4

# Option 2: Lower opacity (60% - more subtle score)
# ffmpeg -ss 2:58.370 -i /Users/christophe.thiebaud/Kitty/video/Kitty_original_from_youtube.mp4 -i ../kitty_overlay.mp4 \
#   -filter_complex "[1:v]scale=1920:340,format=yuva420p,colorchannelmixer=aa=0.6[score]; [0:v][score]overlay=0:H-h-20" \
#   -c:a copy -shortest kitty_final_with_score_60.mp4

# Option 3: No margin (flush bottom alignment)
# ffmpeg -ss 2:58.370 -i /Users/christophe.thiebaud/Kitty/video/Kitty_original_from_youtube.mp4 -i ../kitty_overlay.mp4 \
#   -filter_complex "[1:v]scale=1920:340,format=yuva420p,colorchannelmixer=aa=0.75[score]; [0:v][score]overlay=0:H-h" \
#   -c:a copy -shortest kitty_final_with_score_flush.mp4

# Option 4: Center alignment (if you change your mind)
# ffmpeg -ss 2:58.370 -i /Users/christophe.thiebaud/Kitty/video/Kitty_original_from_youtube.mp4 -i ../kitty_overlay.mp4 \
#   -filter_complex "[1:v]scale=1920:340,format=yuva420p,colorchannelmixer=aa=0.75[score]; [0:v][score]overlay=0:(H-h)/2" \
#   -c:a copy -shortest kitty_final_with_score_center.mp4

# =============================================================================
# EXPLANATION OF FILTER COMPONENTS
# =============================================================================

# [1:v] - Select video stream from second input (kitty_overlay.mp4)
# scale=1920:340 - Scale overlay from 3840x680 to 1920x340 (maintains aspect ratio)
# format=yuva420p - Ensure proper alpha channel handling for transparency
# colorchannelmixer=aa=0.75 - Set transparency level (0.75 = 75% opacity, 0.25 = 25% transparent)
# [score] - Label for the processed overlay stream
# [0:v] - Select video stream from first input (Kitty_original_from_youtube.mp4)
# overlay=0:H-h-20 - Position overlay at x=0, y=video_height-overlay_height-20px
# [overlaid] - Label for video with overlay applied
# fade=t=out:st=33:d=10:color=black - Fade out to black starting at 33s for 10s duration
# -map "[video_out]" - Use the processed video stream
# -map "2:a" - Use audio from third input (TrueKitty.mp3)
# -t 43 - Force output duration to exactly 43 seconds
# -c:v libx264 -c:a aac - Re-encode video and audio (needed for fade effect)

# =============================================================================
# USAGE NOTES
# =============================================================================

# 1. Make sure both input files are accessible from this script location
# 2. Video dimensions detected:
#    - Original: 1920x1080 (Full HD)
#    - Overlay: 3840x680 (4K width) → will be scaled to 1920x340
# 3. Run: chmod +x unmess.sh && ./unmess.sh
# 4. Output will be: kitty_final_with_score.mp4

echo "✅ Video overlay command ready to run!"
echo "📹 Input files needed:"
echo "   - Kitty_original_from_youtube.mp4 (1920x1080 - base video)"
echo "   - kitty_overlay.mp4 (3840x680 - score overlay, will be scaled to 1920x340)"
echo "   - TrueKitty.mp3 (43.128s - audio track)"
echo "🎬 Output: kitty_final_with_score.mp4"
echo "⏱️  Duration: exactly 43 seconds"
echo "🎯 Timing: YouTube video starts at 2:58.370"
echo "🎭 Effects: Fade to black in last 10 seconds (33s-43s)"