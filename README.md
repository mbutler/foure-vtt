# 4e VTT

A virtual tabletop for Dungeons & Dragons 4th Edition, built with a simple Express server and modern web technologies.

## Features

- **4e Rules Engine**: Complete implementation of D&D 4e rules including:
  - Turn management and initiative
  - Action economy (Standard, Move, Minor, Free actions)
  - Movement with pathfinding
  - Second Wind and healing
  - Conditions and effects
  - Attack rolls and damage

- **Visual Interface**: 
  - Grid-based tactical combat
  - Token movement with pathfinding
  - Initiative tracking
  - Character stats display

- **Simple Architecture**:
  - Express.js server with REST API
  - Client-side rendering with Pixi.js
  - Clean separation of game logic and UI

## Quick Start

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start the server:
   ```bash
   bun dev
   ```

3. Open http://localhost:8000 in your browser

## Project Structure

```
├── simple-server.js          # Main Express server
├── public/
│   ├── index.html            # Main UI
│   ├── simple-app.js         # Client-side application
│   └── ui/                   # UI components
│       ├── stage.js          # Pixi.js rendering
│       ├── pathing.js        # Pathfinding algorithms
│       └── templates.js      # Area effect templates
└── src/
    ├── engine/               # Core engine
    │   ├── patches.js        # State management
    │   └── rng.js           # Random number generation
    ├── rules/               # 4e game rules
    │   ├── index.js         # Main rules engine
    │   ├── attacks.js       # Combat mechanics
    │   ├── effects.js       # Status effects
    │   └── healing.js       # Healing and surges
    ├── tactics/             # Tactical gameplay
    │   ├── pathing.js       # Movement algorithms
    │   ├── targeting.js     # Target selection
    │   ├── templates.js     # Area effects
    │   ├── los.js          # Line of sight
    │   ├── grid.js         # Grid utilities
    │   └── specs.js        # Game specifications
    ├── render/              # Rendering utilities
    │   └── stage.js        # Stage management
    └── content/             # Game content
        ├── catalog.js      # Content catalog
        └── schemas.js      # Data schemas
```

## Controls

- **M**: Move mode
- **G**: Measure mode  
- **T**: Target mode
- **Q/E**: Rotate blast facing
- **Enter**: Commit preview
- **Esc**: Cancel preview
- **.**: End Turn

## Development

The project uses a simple REST API approach:

- `GET /api/state` - Get current game state
- `POST /api/move` - Move a token
- `POST /api/end-turn` - End current turn
- `POST /api/second-wind` - Use Second Wind

All game logic is contained in the `src/rules/` directory, making it easy to extend and modify the 4e rules implementation.

