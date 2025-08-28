import { PixiStage } from './ui/stage.js'
import { findPath, toId, inBounds, actorAt } from './ui/pathing.js'

// Game state
let G = null
let selected = null
let mode = 'move'
let preview = null
let stage = null

// UI elements
const logEl = document.getElementById('log')
const currentTurnEl = document.getElementById('current-turn')
const teamAActionsEl = document.getElementById('team-a-actions')
const teamBActionsEl = document.getElementById('team-b-actions')
const currentRoundEl = document.getElementById('current-round')
const endTurnBtn = document.getElementById('end-turn')
const secondWindBtn = document.getElementById('second-wind')
const modeMoveBtn = document.getElementById('mode-move')
const modeMeasureBtn = document.getElementById('mode-measure')
const modeTargetBtn = document.getElementById('mode-target')
const previewInfoEl = document.getElementById('preview-info')
const previewDetailsEl = document.getElementById('preview-details')
const commitPreviewBtn = document.getElementById('commit-preview')
const cancelPreviewBtn = document.getElementById('cancel-preview')

// Initialize
async function init() {
  try {
    console.log('Initializing app...')
    
    // Load initial game state
    await loadGameState()
    
    // Initialize stage
    const stageElement = document.getElementById('stage')
    if (!stageElement) {
      throw new Error('Stage element not found')
    }
    stage = new PixiStage(stageElement)
    console.log('Stage initialized')
    
    // Set up event listeners on the stage canvas
    stage.app.view.addEventListener('click', handleStageClick)
    stage.app.view.addEventListener('mousemove', handleStageMouseMove)
    
    // Set up event listeners
    if (endTurnBtn) endTurnBtn.onclick = handleEndTurn
    if (secondWindBtn) secondWindBtn.onclick = handleSecondWind
    if (modeMoveBtn) modeMoveBtn.onclick = () => setMode('move')
    if (modeMeasureBtn) modeMeasureBtn.onclick = () => setMode('measure')
    if (modeTargetBtn) modeTargetBtn.onclick = () => setMode('target')
    if (commitPreviewBtn) commitPreviewBtn.onclick = handleCommitPreview
    if (cancelPreviewBtn) cancelPreviewBtn.onclick = handleCancelPreview
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown)
    
    // Initial render
    renderAll()
    console.log('App initialization complete')
  } catch (error) {
    console.error('App initialization failed:', error)
  }
}

// Load game state from server
async function loadGameState() {
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch(`/api/state?sessionId=${sessionId}`)
    if (!response.ok) throw new Error('Failed to load game state')
    G = await response.json()
    console.log('Game state loaded:', G)
  } catch (error) {
    console.error('Error loading game state:', error)
    // Fallback to empty state
    G = {
      board: { positions: {}, w: 20, h: 20 },
      turn: { order: [], index: 0 },
      actions: { standard: 0, move: 0, minor: 0 },
      actors: {},
      round: 1
    }
  }
}

// Update game state from Firebase
window.updateGameState = function(newGameState) {
  G = newGameState
  renderAll()
}

// Move token
async function moveToken(actorId, toX, toY, mode = 'walk') {
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId, toX, toY, mode, sessionId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Move failed')
    }
    
    const result = await response.json()
    G = result.gameState
    renderAll()
    appendLog(`Moved ${actorId} to (${toX}, ${toY})`)
  } catch (error) {
    console.error('Move error:', error)
    appendLog(`Move failed: ${error.message}`)
  }
}

// End turn
async function handleEndTurn() {
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch('/api/end-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'End turn failed')
    }
    
    const result = await response.json()
    G = result.gameState
    renderAll()
    appendLog('Turn ended')
  } catch (error) {
    console.error('End turn error:', error)
    appendLog(`End turn failed: ${error.message}`)
  }
}

// Second Wind
async function handleSecondWind() {
  if (!selected) {
    appendLog('No actor selected for Second Wind')
    return
  }
  
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch('/api/second-wind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: selected, sessionId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Second Wind failed')
    }
    
    const result = await response.json()
    G = result.gameState
    renderAll()
    appendLog(`${selected} used Second Wind`)
  } catch (error) {
    console.error('Second Wind error:', error)
    appendLog(`Second Wind failed: ${error.message}`)
  }
}

// Stage click handler
function handleStageClick(event) {
  const rect = event.target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const pos = stage.worldToCell({ x, y })
  
  if (mode === 'move' && selected) {
    moveToken(selected, pos.x, pos.y, 'walk')
  } else if (mode === 'move') {
    // Select token
    const actorId = findActorAt(pos.x, pos.y)
    if (actorId) {
      selected = actorId
      renderAll()
    }
  } else if (mode === 'target' && selected) {
    // Target mode - show targeting preview
    preview = { x: pos.x, y: pos.y }
    renderAll()
  } else if (mode === 'target') {
    // Select token for targeting
    const actorId = findActorAt(pos.x, pos.y)
    if (actorId) {
      selected = actorId
      renderAll()
    }
  }
}

// Stage mouse move handler
function handleStageMouseMove(event) {
  const rect = event.target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const pos = stage.worldToCell({ x, y })
  
  if (mode === 'move' && selected) {
    preview = { x: pos.x, y: pos.y }
    renderAll()
  } else if (mode === 'target' && selected) {
    preview = { x: pos.x, y: pos.y }
    renderAll()
  }
}

// Find actor at position
function findActorAt(x, y) {
  for (const [actorId, position] of Object.entries(G.board.positions)) {
    if (position.x === x && position.y === y) {
      return actorId
    }
  }
  return null
}

// Set mode
function setMode(newMode) {
  mode = newMode
  selected = null
  preview = null
  
  // Update UI
  modeMoveBtn.classList.toggle('active', mode === 'move')
  modeMeasureBtn.classList.toggle('active', mode === 'measure')
  modeTargetBtn.classList.toggle('active', mode === 'target')
  
  renderAll()
}

// Handle keyboard shortcuts
function handleKeyDown(event) {
  switch (event.key.toLowerCase()) {
    case 'm':
      setMode('move')
      break
    case 'g':
      setMode('measure')
      break
    case 't':
      setMode('target')
      break
    case '.':
      handleEndTurn()
      break
    case 'escape':
      handleCancelPreview()
      break
  }
}

// Handle commit preview
function handleCommitPreview() {
  if (preview && selected) {
    moveToken(selected, preview.x, preview.y, 'walk')
    preview = null
    previewInfoEl.style.display = 'none'
  }
}

// Handle cancel preview
function handleCancelPreview() {
  preview = null
  previewInfoEl.style.display = 'none'
  renderAll()
}

// Append to log
function appendLog(message) {
  const entry = document.createElement('div')
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`
  logEl.appendChild(entry)
  logEl.scrollTop = logEl.scrollHeight
}

// Render panel
function renderPanel() {
  try {
    if (!G) {
      console.log('No game state to render')
      return
    }
    
    console.log('Rendering panel with game state:', G)
    
    // Update turn info
    const currentActor = G.turn.order[G.turn.index]
    if (currentTurnEl) currentTurnEl.textContent = currentActor || '-'
    if (currentRoundEl) currentRoundEl.textContent = G.round || 1
    
    // Update action counts
    const actions = G.actions || {}
    if (teamAActionsEl) teamAActionsEl.textContent = `${actions.standard || 0}/${actions.move || 0}/${actions.minor || 0}`
    if (teamBActionsEl) teamBActionsEl.textContent = `${actions.standard || 0}/${actions.move || 0}/${actions.minor || 0}`
    
    // Update preview info
    if (preview && selected) {
      if (previewInfoEl) previewInfoEl.style.display = 'block'
      if (previewDetailsEl) previewDetailsEl.textContent = `Move ${selected} to (${preview.x}, ${preview.y})`
    } else {
      if (previewInfoEl) previewInfoEl.style.display = 'none'
    }
  } catch (error) {
    console.error('Error rendering panel:', error)
  }
}

// Render stage
function renderStage() {
  if (!G || !stage) return
  
  // Render grid
  stage.drawGrid(G.board)
  
  // Render tokens
  stage.drawTokens(G)
  
  // Render preview path if available
  if (preview && selected) {
    const start = G.board.positions[selected]
    if (start) {
      if (mode === 'move') {
        const pathResult = findPath(G, start, preview)
        if (pathResult) {
          stage.drawPathHighlight(pathResult.path, 0x3182ce)
        }
      } else if (mode === 'target') {
        // Show targeting preview - burst 1 around the preview point
        const targetCells = new Set()
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const cell = { x: preview.x + dx, y: preview.y + dy }
            if (cell.x >= 0 && cell.y >= 0 && cell.x < G.board.w && cell.y < G.board.h) {
              targetCells.add(`${cell.x},${cell.y}`)
            }
          }
        }
        stage.drawTemplateCells(targetCells, G.board, 0x38a169) // Green color
      }
    }
  }
}

// Render everything
function renderAll() {
  renderPanel()
  renderStage()
}

// Start the app
init()
