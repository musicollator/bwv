# BWV Player

A web-based musical score player for Bach's works with real-time visual synchronization. Play audio while watching notes highlight on the score in sync.

## Features

- **Real-time note highlighting** during audio playback with channel-specific colors
- **Smart bar tracking** with LilyPond-calibrated timing precision
- **Measure analysis visualization** (work in progress)
- **Responsive design** with automatic scrolling 
- **Configurable works** via YAML configuration files
- **Modular architecture** for easy extensibility

### Load Specific Works
```
https://your-domain.com                  # Loads bwv1006 (default)
https://your-domain.com/?werk=543        # Loads bwv543
https://your-domain.com/?werk=test       # Loads test (for local development)
```

### Parameter Rules
- **Digits only** → prefixed with "bwv" (e.g., `?werk=846` → `bwv846`)
- **test + non-digits** → used as-is (e.g., `?werk=test` → `test`)
- **Invalid format** → falls back to `bwv1006`

## License

© 2025 Christophe Thiebaud
