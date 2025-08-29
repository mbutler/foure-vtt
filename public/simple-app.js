import { PixiStage } from './ui/stage.js'
import { findPath, toId, inBounds, actorAt } from './ui/pathing.js'
import { PowersPanel } from './ui/powers-panel.js'
import { GameLog } from './ui/log.js'

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
const shortRestBtn = document.getElementById('short-rest')
const longRestBtn = document.getElementById('long-rest')
const deathSaveBtn = document.getElementById('death-save')
const modeMoveBtn = document.getElementById('mode-move')
const modeMeasureBtn = document.getElementById('mode-measure')
const modeTargetBtn = document.getElementById('mode-target')
const modeAuraBtn = document.getElementById('mode-aura')

// Character UI elements
const characterNameEl = document.querySelector('.character-name')
const characterLevelEl = document.querySelector('.character-level')
const hpEl = document.querySelector('.stat-item:nth-child(1) .stat-value')
const surgesEl = document.querySelector('.stat-item:nth-child(2) .stat-value')
const acEl = document.querySelector('.stat-item:nth-child(3) .stat-value')

// Action economy elements
const standardActionEl = document.getElementById('standard-action')
const moveActionEl = document.getElementById('move-action')
const minorActionEl = document.getElementById('minor-action')

// UI Components
let powersPanel = null
let gameLog = null
let characterImport = null

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
    if (shortRestBtn) shortRestBtn.onclick = handleShortRest
    if (longRestBtn) longRestBtn.onclick = handleLongRest
    if (deathSaveBtn) deathSaveBtn.onclick = handleDeathSave
    if (modeMoveBtn) modeMoveBtn.onclick = () => setMode('move')
    if (modeMeasureBtn) modeMeasureBtn.onclick = () => setMode('measure')
    if (modeTargetBtn) modeTargetBtn.onclick = () => setMode('target')
    if (modeAuraBtn) modeAuraBtn.onclick = () => setMode('aura')
    
    // Action economy click handlers
    if (standardActionEl) standardActionEl.onclick = () => toggleAction('standard')
    if (moveActionEl) moveActionEl.onclick = () => toggleAction('move')
    if (minorActionEl) minorActionEl.onclick = () => toggleAction('minor')
    
    // Initialize character import
    const characterImportContainer = document.getElementById('character-import-container')
    if (characterImportContainer && window.CharacterImport) {
      characterImport = new window.CharacterImport(characterImportContainer, (characterData) => {
        updateCharacterDisplay(characterData)
        updatePowersFromCharacter(characterData)
        
        if (gameLog) {
          gameLog.addSystemEntry(`Character "${characterData.name}" imported successfully`, 'success')
        }
      })
    }
    
    // Initialize powers panel
    const powersContainer = document.getElementById('powers-container')
    if (powersContainer) {
      // Create a compatible game state for the powers panel
      const compatibleGameState = {
        ...G,
        actors: new Map(Object.entries(G.actors || {}))
      }
      powersPanel = new PowersPanel(powersContainer, compatibleGameState, handlePowerUse)
    }
    
    // Initialize game log
    if (logEl) {
      gameLog = new GameLog(logEl)
      gameLog.addSystemEntry('Game initialized successfully', 'success')
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown)
    
    // Initial render
    renderAll()
    console.log('App initialization complete')
  } catch (error) {
    console.error('App initialization failed:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Initialization failed: ${error.message}`, 'error')
    }
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

// Toggle action usage
function toggleAction(actionType) {
  const actionEl = document.getElementById(`${actionType}-action`)
  if (actionEl) {
    actionEl.classList.toggle('used')
    const statusEl = actionEl.querySelector('.action-status')
    if (statusEl) {
      statusEl.textContent = actionEl.classList.contains('used') ? '✗' : '✓'
    }
    
    if (gameLog) {
      const currentActor = G.turn.order[G.turn.index]
      const actorName = G.actors[currentActor]?.name || currentActor
      const action = actionEl.classList.contains('used') ? 'used' : 'regained'
      gameLog.addSystemEntry(`${actorName} ${action} ${actionType} action`, 'info')
    }
  }
}

// Handle short rest
async function handleShortRest() {
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch('/api/short-rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Short rest failed')
    }
    
    const result = await response.json()
    G = result.gameState
    
    // Log short rest
    if (gameLog) {
      const currentActor = G.turn.order[G.turn.index]
      const actorName = G.actors[currentActor]?.name || currentActor
      gameLog.addSystemEntry(`${actorName} takes a short rest`, 'info')
    }
    
    renderAll()
  } catch (error) {
    console.error('Short rest error:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Short rest failed: ${error.message}`, 'error')
    }
  }
}

// Handle long rest
async function handleLongRest() {
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch('/api/long-rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Long rest failed')
    }
    
    const result = await response.json()
    G = result.gameState
    
    // Log long rest
    if (gameLog) {
      const currentActor = G.turn.order[G.turn.index]
      const actorName = G.actors[currentActor]?.name || currentActor
      gameLog.addSystemEntry(`${actorName} takes a long rest`, 'info')
    }
    
    renderAll()
  } catch (error) {
    console.error('Long rest error:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Long rest failed: ${error.message}`, 'error')
    }
  }
}

// Handle death save
async function handleDeathSave() {
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch('/api/death-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Death save failed')
    }
    
    const result = await response.json()
    G = result.gameState
    
    // Log death save
    if (gameLog) {
      const currentActor = G.turn.order[G.turn.index]
      const actorName = G.actors[currentActor]?.name || currentActor
      const saveResult = result.success ? 'succeeds' : 'fails'
      gameLog.addSystemEntry(`${actorName} death save ${saveResult}`, result.success ? 'success' : 'error')
    }
    
    renderAll()
  } catch (error) {
    console.error('Death save error:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Death save failed: ${error.message}`, 'error')
    }
  }
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
    
    // Log movement
    if (gameLog) {
      const actorName = G.actors[actorId]?.name || actorId
      const fromPos = G.board.positions[actorId]
      const from = fromPos ? `(${fromPos.x}, ${fromPos.y})` : 'unknown'
      const to = `(${toX}, ${toY})`
      const distance = Math.abs(toX - fromPos.x) + Math.abs(toY - fromPos.y)
      
      gameLog.addMovementEntry(actorName, from, to, distance)
    }
    
    renderAll()
  } catch (error) {
    console.error('Move error:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Move failed: ${error.message}`, 'error')
    }
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
    
    // Log turn end
    if (gameLog) {
      const currentActor = G.turn.order[G.turn.index]
      const actorName = G.actors[currentActor]?.name || currentActor
      gameLog.addTurnEntry(actorName, G.round, G.turn.index + 1)
    }
    
    renderAll()
  } catch (error) {
    console.error('End turn error:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`End turn failed: ${error.message}`, 'error')
    }
  }
}

// Second Wind
async function handleSecondWind() {
  if (!selected) {
    if (gameLog) {
      gameLog.addSystemEntry('No actor selected for Second Wind', 'warning')
    }
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
    
    // Log second wind usage
    if (gameLog) {
      const actorName = G.actors[selected]?.name || selected
      gameLog.addStatusEntry(actorName, 'Second Wind', 'Gain healing surge')
    }
    
    renderAll()
  } catch (error) {
    console.error('Second Wind error:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Second Wind failed: ${error.message}`, 'error')
    }
  }
}

// Handle power use
async function handlePowerUse(powerId, targets) {
  try {
    const sessionId = window.firebase ? window.firebase.currentSessionId() : 'default'
    const response = await fetch('/api/use-power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId, 
        powerId, 
        targets 
      })
    })
    if (!response.ok) throw new Error('Failed to use power')
    const result = await response.json()
    G = result.gameState
    
    // Log power usage
    if (gameLog) {
      const currentActor = G.turn.order[G.turn.index]
      const actorName = G.actors[currentActor]?.name || currentActor
      const power = powersPanel?.actorPowers.get(currentActor)?.find(p => (p.id || p._id) === powerId)
      const powerName = power?.name || powerId
      const powerType = power?.powerType || power?.system?.powerType || 'at-will'
      const targetNames = targets?.map(t => G.actors[t]?.name || t) || []
      
      gameLog.addPowerEntry(actorName, powerName, powerType, targetNames, { success: true, details: 'Power used successfully' })
    }
    
    renderAll()
  } catch (error) {
    console.error('Error using power:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Power use failed: ${error.message}`, 'error')
    }
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
  modeAuraBtn.classList.toggle('active', mode === 'aura')
  
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
    case 'a':
      setMode('aura')
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
  }
}

// Handle cancel preview
function handleCancelPreview() {
  preview = null
  renderAll()
}

// Render panel
function renderPanel() {
  try {
    if (!G) {
      console.log('No game state to render')
      return
    }
    
    // Update turn info
    const currentActor = G.turn.order[G.turn.index]
    if (currentTurnEl) currentTurnEl.textContent = currentActor || '-'
    if (currentRoundEl) currentRoundEl.textContent = G.round || 1
    
    // Update action counts
    const actions = G.actions || {}
    if (teamAActionsEl) teamAActionsEl.textContent = `${actions.standard || 0}/${actions.move || 0}/${actions.minor || 0}`
    if (teamBActionsEl) teamBActionsEl.textContent = `${actions.standard || 0}/${actions.move || 0}/${actions.minor || 0}`
    
    // Update character info
    if (currentActor && G.actors[currentActor]) {
      const actor = G.actors[currentActor]
      if (characterNameEl) characterNameEl.textContent = actor.name || currentActor
      if (characterLevelEl) characterLevelEl.textContent = `Level ${actor.level || 1}`
      if (hpEl) {
        const hpText = `${actor.currentHP || 0}/${actor.maxHP || 0}`
        hpEl.textContent = hpText
        hpEl.className = 'stat-value' + (actor.currentHP < actor.maxHP * 0.5 ? ' damaged' : '')
      }
      if (surgesEl) surgesEl.textContent = `${actor.currentSurges || 0}/${actor.maxSurges || 0}`
      if (acEl) acEl.textContent = actor.ac || 10
    }
    
    // Update powers panel
    if (powersPanel) {
      // Create a compatible game state for the powers panel
      const compatibleGameState = {
        ...G,
        actors: new Map(Object.entries(G.actors || {}))
      }
      powersPanel.update(compatibleGameState)
    }
  } catch (error) {
    console.error('Error rendering panel:', error)
    if (gameLog) {
      gameLog.addSystemEntry(`Panel render error: ${error.message}`, 'error')
    }
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

// Update character display with imported data
function updateCharacterDisplay(characterData) {
  if (!characterData) return
  
  // Update character info
  if (characterNameEl) characterNameEl.textContent = characterData.name
  if (characterLevelEl) characterLevelEl.textContent = `Level ${characterData.level}`
  
  // Update character info section with imported data
  const characterInfo = document.querySelector('.character-info')
  if (characterInfo) {
    const characterHeader = characterInfo.querySelector('.character-header')
    if (characterHeader) {
      const nameEl = characterHeader.querySelector('.character-name')
      const levelEl = characterHeader.querySelector('.character-level')
      
      if (nameEl) nameEl.textContent = characterData.name
      if (levelEl) levelEl.textContent = `Level ${characterData.level}`
    }
  }
}

// Update powers panel with character powers
function updatePowersFromCharacter(characterData) {
  if (!characterData || !powersPanel) return
  
  // Convert character powers to the format expected by PowersPanel
  const characterPowers = new Map()
  const currentActor = 'player' // or get from game state
  
  const allPowers = []
  
  // Process powers from the new format
  characterData.powers.forEach(power => {
    const powerData = power.data || {}
    allPowers.push({
      ...powerData,
      powerType: power.usage.toLowerCase(),
      id: power.name,
      name: power.name,
      action: powerData.action || 'Standard',
      target: powerData.target || 'One creature',
      range: powerData.range || 'Melee',
      description: powerData.description || powerData.flavor || ''
    })
  })
  
  characterPowers.set(currentActor, allPowers)
  
  // Update the powers panel
  powersPanel.actorPowers = characterPowers
  
  // Create a compatible game state for the powers panel
  const compatibleGameState = {
    ...G,
    actors: new Map(Object.entries(G.actors || {}))
  }
  
  powersPanel.update(compatibleGameState)
}

// Reset character display to defaults
function resetCharacterDisplay() {
  if (characterNameEl) characterNameEl.textContent = 'Gandalf the Grey'
  if (characterLevelEl) characterLevelEl.textContent = 'Level 5'
  if (hpEl) {
    hpEl.textContent = '32/45'
    hpEl.className = 'stat-value damaged'
  }
  if (surgesEl) surgesEl.textContent = '8/10'
  if (acEl) acEl.textContent = '18'
  
  // Reset character info section
  const characterInfo = document.querySelector('.character-info')
  if (characterInfo) {
    const characterHeader = characterInfo.querySelector('.character-header')
    if (characterHeader) {
      const nameEl = characterHeader.querySelector('.character-name')
      const levelEl = characterHeader.querySelector('.character-level')
      
      if (nameEl) nameEl.textContent = 'Gandalf the Grey'
      if (levelEl) levelEl.textContent = 'Level 5'
    }
    
    const statsGrid = characterInfo.querySelector('.character-stats')
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="stat-item">
          <div class="stat-label">HP</div>
          <div class="stat-value damaged">32/45</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Surges</div>
          <div class="stat-value">8/10</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">AC</div>
          <div class="stat-value">18</div>
        </div>
      `
    }
  }
  
  // Reset powers panel
  if (powersPanel) {
    powersPanel.actorPowers = new Map()
    powersPanel.update(G)
  }
}

// Start the app
init()
