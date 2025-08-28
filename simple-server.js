import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { initialState } from './src/rules/index.js'
import { applyPatches } from './src/engine/patches.js'
import * as Rules from './src/rules/index.js'
import { nanoid } from 'nanoid'
import admin from 'firebase-admin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 8000

// Initialize Firebase Admin SDK
// For local development, we'll use in-memory storage instead of Firebase
// In production, you'd use a service account key file
const USE_FIREBASE = process.env.NODE_ENV === 'production'

if (USE_FIREBASE) {
  try {
    // For production, you should use a service account key file
    // For now, we'll use the default credentials
    admin.initializeApp({
      projectId: 'foure-vtt',
      // If you have a service account key file, uncomment and use:
      // credential: admin.credential.cert(require('./path/to/serviceAccountKey.json'))
    })
    console.log('Firebase Admin SDK initialized for production')
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error)
    console.log('Falling back to in-memory storage')
  }
}

const db = USE_FIREBASE ? admin.firestore() : null

// Middleware
app.use(express.json())
app.use(express.static('public'))

// Game session management with Firebase sync
const gameSessions = new Map()

async function createGameSession(sessionId = null) {
  const id = sessionId || nanoid()
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
  
  // Store in memory
  gameSessions.set(id, gameState)
  
  // Sync to Firestore if available
  if (db) {
    try {
      await db.collection('games').doc(id).set({
        gameState: gameState,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log(`Game session ${id} created and synced to Firestore`)
    } catch (error) {
      console.error('Error syncing to Firestore:', error)
    }
  } else {
    console.log(`Game session ${id} created (in-memory storage)`)
  }
  
  return id
}

// Helper to get game state
function getGameState(sessionId = 'default') {
  return gameSessions.get(sessionId)
}

// Helper to sync game state to Firestore
async function syncGameStateToFirestore(sessionId, gameState) {
  if (!db) return // Skip if Firebase not available
  
  try {
    await db.collection('games').doc(sessionId).update({
      gameState: gameState,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
  } catch (error) {
    console.error('Error syncing to Firestore:', error)
  }
}

// Load existing games from Firestore on startup
async function loadGamesFromFirestore() {
  if (!db) return // Skip if Firebase not available
  
  try {
    const snapshot = await db.collection('games').get()
    snapshot.forEach(doc => {
      const data = doc.data()
      if (data.gameState) {
        gameSessions.set(doc.id, data.gameState)
        console.log(`Loaded game session ${doc.id} from Firestore`)
      }
    })
  } catch (error) {
    console.error('Error loading games from Firestore:', error)
  }
}

// REST endpoint for moving tokens using 4e rules
app.post('/api/move', async (req, res) => {
  const { actorId, toX, toY, mode, sessionId = 'default' } = req.body
  console.log('REST move request:', { actorId, toX, toY, mode, sessionId })
  
  const gameState = getGameState(sessionId)
  if (!gameState) {
    return res.status(404).json({ error: 'Game session not found' })
  }
  
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
  
  // Sync to Firestore
  await syncGameStateToFirestore(sessionId, gameState)
  
  console.log('Move completed using 4e rules. New positions:', gameState.board.positions)
  
  res.json({ 
    success: true, 
    positions: gameState.board.positions,
    gameState: gameState
  })
})

// Endpoint for ending turn
app.post('/api/end-turn', async (req, res) => {
  const { sessionId = 'default' } = req.body
  console.log('End turn request for session:', sessionId)
  
  const gameState = getGameState(sessionId)
  if (!gameState) {
    return res.status(404).json({ error: 'Game session not found' })
  }
  
  const patches = Rules.advanceTurn(gameState)
  applyPatches(gameState, patches)
  
  // Sync to Firestore
  await syncGameStateToFirestore(sessionId, gameState)
  
  console.log('Turn advanced. Current turn:', gameState.turn)
  
  res.json({ 
    success: true, 
    gameState: gameState
  })
})

// Endpoint for using Second Wind
app.post('/api/second-wind', async (req, res) => {
  const { actorId, sessionId = 'default' } = req.body
  console.log('Second Wind request for:', actorId, 'session:', sessionId)
  
  const gameState = getGameState(sessionId)
  if (!gameState) {
    return res.status(404).json({ error: 'Game session not found' })
  }
  
  if (!actorId || !gameState.actors[actorId]) {
    return res.status(400).json({ error: 'Invalid actor' })
  }
  
  const patches = Rules.secondWind(gameState, actorId)
  applyPatches(gameState, patches)
  
  // Sync to Firestore
  await syncGameStateToFirestore(sessionId, gameState)
  
  console.log('Second Wind used by', actorId)
  
  res.json({ 
    success: true, 
    gameState: gameState
  })
})

// Endpoint to get current game state
app.get('/api/state', (req, res) => {
  const { sessionId = 'default' } = req.query
  const gameState = getGameState(sessionId)
  
  if (!gameState) {
    return res.status(404).json({ error: 'Game session not found' })
  }
  
  res.json(gameState)
})

// Endpoint to create a new game session
app.post('/api/sessions', async (req, res) => {
  const sessionId = await createGameSession()
  res.json({ 
    success: true, 
    sessionId,
    gameState: getGameState(sessionId)
  })
})

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'))
})

// Initialize server
async function startServer() {
  // Load existing games from Firestore
  await loadGamesFromFirestore()
  
  // Create default session if none exists
  if (!gameSessions.has('default')) {
    await createGameSession('default')
  }
  
  app.listen(PORT, () => {
    console.log(`Simple 4e VTT server on http://localhost:${PORT}`)
    if (USE_FIREBASE) {
      console.log('Firebase integration enabled')
    } else {
      console.log('Running with in-memory storage (Firebase disabled for local development)')
    }
    console.log('Default game session initialized with tokens at:', getGameState('default').board.positions)
  })
}

startServer()
