# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

BWV Player is a web-based musical score player for Bach's works with real-time visual synchronization. It uses a modular architecture with dynamic work loading.

### Core System Components

**Synchronisator (`synchronisator.mjs`)**: Unified timing and synchronization module that handles all music playback synchronization using YAML format data. Manages note highlighting, bar progression, and channel-specific coloring.

**Dynamic Work Loading (`index.js`)**: Main application controller that dynamically loads different Bach works (BWV numbers) based on URL parameters. Handles work switching without page reloads.

**Navigation System (`js/menu.js`)**: BWV navigation menu system that provides work selection and navigation between different pieces.

**Channel Coloring (`js/channel2colour.js`)**: Intelligent channel-to-color mapping system that reads from CSS and applies consistent coloring across different musical voices/channels.

**Musical Highlighter (`js/musical-highlighter.js`)**: Advanced highlighting system for musical analysis and visualization.

### Work Structure

Each BWV work is organized in its own directory (`bwv{number}/`) containing:
- `exports/{bwv}.config.yaml` - Work configuration (title, duration, measures, etc.)
- `exports/{bwv}.yaml` - Synchronization data with timing and note references
- `exports/{bwv}.svg` - Musical score as SVG with data attributes
- `exports/{bwv}.mp3` - Audio file
- `exports/{bwv}.pdf` - PDF score

### Data Format

**Sync YAML Structure**:
- `meta`: Contains timing bounds, channel statistics, total measures
- `flow`: Array of timing events in format `[startTick, channel, endTick, hrefs]` for notes and `[tick, ~, barNumber, 'bar']` for bars

**SVG Requirements**: 
- Note elements must have `data-ref` attributes matching hrefs in sync data
- Bar elements must have `data-bar` attributes with bar numbers

### URL Parameters

- `?werk=543` → loads `bwv543`
- `?werk=test` → loads `test` (development)
- No parameter → defaults to `bwv1006`

### Key Development Patterns

**Work Loading**: Use `loadWorkContent(workId)` to switch between works dynamically. This stops current playback, loads new configuration/data, and reinitializes synchronization.

**Timing System**: All timing calculations go through `tickToSeconds()` method in Synchronisator. Visual lead time adjustments are applied for mobile devices.

**Element Caching**: Synchronisator pre-caches DOM elements by `data-ref` and `data-bar` attributes for performance.

**Channel Management**: Notes are assigned to channels (0, 1, etc.) and automatically get color classes (`channel-0`, `channel-1`) based on intelligent mapping.

## Development Commands

No build system - this is a client-side JavaScript application that runs directly in the browser.

**Local Development**: Serve from any HTTP server. Use `?werk=test` for development work.

## Submodule Management

Some BWV works (like bwv245) are managed as git submodules with sparse checkout to include only the `exports/` directory. See `SUBMODULE.md` for detailed submodule commands.

**Update submodule**:
```bash
cd bwv/bwv245
git pull origin main
cd ..
git add bwv245
git commit -m "Update bwv245 submodule"
```

## Testing

Test configurations can be created by symlinking exports directory:
```bash
ln -s /path/to/test/exports test/exports
```

## Mobile Considerations

Mobile devices automatically get 0.2s additional visual lead time to account for audio latency. This is handled automatically in `applyMobileTimingAdjustment()`.