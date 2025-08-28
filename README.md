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

The project uses a simple REST API approach with session management:

- `GET /api/state?sessionId=default` - Get current game state
- `POST /api/move` - Move a token (include `sessionId` in body)
- `POST /api/end-turn` - End current turn (include `sessionId` in body)
- `POST /api/second-wind` - Use Second Wind (include `sessionId` in body)
- `POST /api/sessions` - Create a new game session

All game logic is contained in the `src/rules/` directory, making it easy to extend and modify the 4e rules implementation.

### Session Management

The server supports multiple game sessions:
- Each session has a unique ID
- Default session is always available
- Sessions are stored in memory for local development
- Firebase integration available for production (set NODE_ENV=production)

### Firebase Integration

The project includes Firebase integration for real-time multiplayer:
- **Local Development**: Uses in-memory storage (no Firebase required)
- **Production**: Uses Firestore for persistent, real-time game state
- **Client**: Real-time updates via Firebase listeners
- **Server**: Automatic sync to Firestore on all state changes

To enable Firebase in production:
```bash
NODE_ENV=production bun dev
```

