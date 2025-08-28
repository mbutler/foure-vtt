import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { initialState } from './src/rules/index.js'
import { applyPatches } from './src/engine/patches.js'
import * as Rules from './src/rules/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 8000

// Middleware
app.use(express.json())
app.use(express.static('public'))

// Initialize game state using the existing rules system
const gameState = initialState(42)
// Apply initial setup patches
const initialPatches = [
  { type: 'set', path: 'turn.order', value: ['A1','E1'] },
  { type: 'set', path: 'turn.index', value: 0 },
  { type: 'set', path: 'actions', value: { 
    standard: 1, 
    move: 1, 
    minor: 1, 
    free: 'unbounded', 
    immediateUsedThisRound: false 
  }},
  { type: 'set', path: 'actors.A1', value: { team:'A', hp:{ current:24, max:30, temp:0 }, surges:{ remaining:7, value:7 }}},
  { type: 'set', path: 'actors.E1', value: { team:'B', hp:{ current:30, max:30, temp:0 }, surges:{ remaining:0, value:0 }}},
  { type: 'set', path: 'board.positions.A1', value: { x:2, y:2 }},
  { type: 'set', path: 'board.positions.E1', value: { x:8, y:4 }}
]
applyPatches(gameState, initialPatches)

// REST endpoint for moving tokens using 4e rules
app.post('/api/move', (req, res) => {
  const { actorId, toX, toY, mode } = req.body
  console.log('REST move request:', { actorId, toX, toY, mode })
  
  if (!actorId || toX == null || toY == null) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  
  if (!gameState.board.positions[actorId]) {
    return res.status(400).json({ error: 'Actor not found' })
  }
  
  const toCell = { x: toX, y: toY }
  
  // Use the proper 4e move rules
  const pv = Rules.previewMove(gameState, actorId, toCell, mode || 'walk')
  if (!pv || !pv.ok) {
    return res.status(400).json({ error: 'Invalid move' })
  }
  
  // Apply the move using the rules system
  const patches = [
    ...Rules.buildMovePreviewLog(actorId, pv, mode || 'walk'),
    ...Rules.commitMove(gameState, actorId, pv)
  ]
  applyPatches(gameState, patches)
  
  console.log('Move completed using 4e rules. New positions:', gameState.board.positions)
  
  res.json({ 
    success: true, 
    positions: gameState.board.positions,
    gameState: gameState
  })
})

// Endpoint for ending turn
app.post('/api/end-turn', (req, res) => {
  console.log('End turn request')
  
  const patches = Rules.advanceTurn(gameState)
  applyPatches(gameState, patches)
  
  console.log('Turn advanced. Current turn:', gameState.turn)
  
  res.json({ 
    success: true, 
    gameState: gameState
  })
})

// Endpoint for using Second Wind
app.post('/api/second-wind', (req, res) => {
  const { actorId } = req.body
  console.log('Second Wind request for:', actorId)
  
  if (!actorId || !gameState.actors[actorId]) {
    return res.status(400).json({ error: 'Invalid actor' })
  }
  
  const patches = Rules.secondWind(gameState, actorId)
  applyPatches(gameState, patches)
  
  console.log('Second Wind used by', actorId)
  
  res.json({ 
    success: true, 
    gameState: gameState
  })
})

// Endpoint to get current game state
app.get('/api/state', (req, res) => {
  res.json(gameState)
})

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

app.listen(PORT, () => {
  console.log(`Simple 4e VTT server on http://localhost:${PORT}`)
  console.log('Game state initialized with tokens at:', gameState.board.positions)
})
