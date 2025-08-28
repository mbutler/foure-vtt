import { PixiStage } from './ui/stage.js'
import * as Pathing from './ui/pathing.js'
import * as Templates from './ui/templates.js'

// DOM elements
const elStage = document.getElementById('stage')
const elLog = document.getElementById('log')
const elSel = document.getElementById('sel-actor')
const elHp = document.getElementById('hp')
const elThp = document.getElementById('thp')
const elSurges = document.getElementById('surges')
const elInit = document.getElementById('init')
const elStd = document.getElementById('cnt-standard')
const elMov = document.getElementById('cnt-move')
const elMin = document.getElementById('cnt-minor')
const elEnd = document.getElementById('btn-end-turn')
const btnMove = document.getElementById('btn-mode-move')
const btnMeasure = document.getElementById('btn-mode-measure')
const btnSecondWind = document.getElementById('btn-second-wind')

// Game state
let G = null
let selected = null
let mode = 'move'
let preview = null
let measureStart = null
let currentPower = null

// Initialize stage
const stage = new PixiStage(elStage)

// Load initial game state
async function loadGameState() {
  try {
    const response = await fetch('/api/state')
    G = await response.json()
    console.log('Loaded game state:', G)
    renderAll()
  } catch (error) {
    console.error('Failed to load game state:', error)
  }
}

// Move token via REST API
async function moveToken(actorId, toX, toY, mode = 'walk') {
  console.log('Moving token:', { actorId, toX, toY, mode })
  
  try {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId, toX, toY, mode })
    })
    
    const data = await response.json()
    if (data.success) {
      console.log('Move successful:', data.positions)
      G.board.positions = data.positions
      renderAll()
      appendLog('move-commit', `${actorId} -> ${toX},${toY}`)
    } else {
      console.error('Move failed:', data.error)
      appendLog('error', `Move failed: ${data.error}`)
    }
  } catch (error) {
    console.error('Move error:', error)
    appendLog('error', `Move error: ${error.message}`)
  }
}

// UI functions
function appendLog(type, msg) {
  const div = document.createElement('div')
  div.className = `entry ${type}`
  const icon = document.createElement('span')
  icon.className = 'icon'
  icon.textContent = type === 'attack-roll' ? '🎲' : type === 'damage-apply' ? '💥' : type === 'save' ? '🛡' : type === 'manual-override' ? '✏️' : '•'
  const msgEl = document.createElement('span')
  msgEl.className = 'msg'
  msgEl.textContent = `[${Date.now()}] ${msg}`
  div.appendChild(icon)
  div.appendChild(msgEl)
  elLog.appendChild(div)
  elLog.scrollTop = elLog.scrollHeight
}

function renderPanel() {
  if (!G || !G.turn || !Array.isArray(G.turn.order)) return
  
  // Initiative list
  elInit.innerHTML = ''
  const order = G.turn.order || []
  order.forEach((id, idx) => {
    const btn = document.createElement('button')
    btn.className = 'btn'
    btn.style.padding = '3px 6px'
    btn.style.marginRight = '6px'
    btn.textContent = id + (idx === G.turn.index ? ' *' : '')
    if (idx === G.turn.index) btn.style.background = '#243049'
    btn.onclick = () => { selected = id; renderPanel() }
    elInit.appendChild(btn)
  })
  
  const idx = Math.min(G.turn.index || 0, Math.max(order.length - 1, 0))
  const id = selected || (order.length ? order[idx] : null)
  const actor = (id && G.actors && G.actors[id]) || {}
  
  elSel.textContent = id || '—'
  const hp = actor.hp || { current: 0, max: 0, temp: 0 }
  elHp.textContent = `${hp.current}/${hp.max}`
  elThp.textContent = `${hp.temp}`
  const surges = actor.surges || { remaining: 0, value: 0 }
  elSurges.textContent = `${surges.remaining} (${surges.value})`
  const actions = G.actions || { standard: 0, move: 0, minor: 0 }
  elStd.textContent = actions.standard
  elMov.textContent = actions.move
  elMin.textContent = actions.minor
}

function renderAll() {
  if (!G) return
  stage.drawGrid(G.board)
  stage.drawTokens(G)
  renderPanel()
}

function setMode(m) { 
  mode = m; 
  appendLog('mode', `Mode: ${m}`) 
}

// Event handlers
btnMove.onclick = () => setMode('move')
btnMeasure.onclick = () => setMode('measure')
btnSecondWind.onclick = async () => {
  const id = selected || (G && G.turn && G.turn.order[G.turn.index])
  if (!id) return
  
  try {
    const response = await fetch('/api/second-wind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: id })
    })
    const data = await response.json()
    if (data.success) {
      G = data.gameState
      renderAll()
      appendLog('info', `${id} uses Second Wind`)
    }
  } catch (error) {
    console.error('Second Wind error:', error)
    appendLog('error', 'Failed to use Second Wind')
  }
}

elEnd.onclick = async () => {
  try {
    const response = await fetch('/api/end-turn', { method: 'POST' })
    const data = await response.json()
    if (data.success) {
      G = data.gameState
      renderAll()
      appendLog('info', 'Turn ended')
    }
  } catch (error) {
    console.error('End turn error:', error)
    appendLog('error', 'Failed to end turn')
  }
}

// Click to select token
stage.tokenLayer && (stage.tokenLayer.eventMode = 'static')
stage.tokenLayer && stage.tokenLayer.on('click', (e) => {
  const tgt = e.target
  if (tgt && typeof tgt.name === 'string' && tgt.name.startsWith('token:')) {
    selected = tgt.name.slice('token:'.length)
    renderPanel()
  }
})

// Move/Measure previews: hover shows path; click commits (move) or sets endpoints (measure)
stage.app.view.addEventListener('mousemove', (e) => {
  if (!G || !G.board) return
  if (!selected) return
  const rect = stage.app.view.getBoundingClientRect()
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  const cell = stage.worldToCell(pt)
  
  if (mode === 'move') {
    const from = G.board.positions[selected]
    if (!from) return
    const res = Pathing.findPath(G, from, cell)
    if (res && res.path && res.path.length > 1) {
      stage.drawPathHighlight(res.path)
    } else {
      stage.drawPathHighlight(null)
    }
  } else if (mode === 'measure') {
    if (measureStart) {
      stage.drawPathHighlight([measureStart, cell])
    }
  }
})

// Move/Measure previews on left click
stage.app.view.addEventListener('click', (e) => {
  if (!G || !G.board) return
  if (!selected) return
  
  if (mode === 'measure') {
    const rect = stage.app.view.getBoundingClientRect()
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const cell = stage.worldToCell(pt)
    if (!measureStart) {
      measureStart = cell
      stage.drawPathHighlight([measureStart, cell])
    } else {
      const dist = Math.max(Math.abs(cell.x - measureStart.x), Math.abs(cell.y - measureStart.y))
      appendLog('measure', `${measureStart.x},${measureStart.y} → ${cell.x},${cell.y} = ${dist}`)
      measureStart = null
      stage.drawPathHighlight(null)
    }
    return
  }
  
  if (mode !== 'move' && mode !== 'target') return
  const rect = stage.app.view.getBoundingClientRect()
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  const cell = stage.worldToCell(pt)
  
  if (mode === 'move') {
    const res = Pathing.findPath(G, G.board.positions[selected], cell)
    if (!res) { 
      appendLog('warn', 'Path blocked'); 
      return 
    }
    const to = res.path[res.path.length - 1]
    moveToken(selected, to.x, to.y, 'walk')
    stage.drawPathHighlight(null)
  } else if (mode === 'target') {
    const attacker = G.board.positions[selected]
    if (!attacker) return
    if (currentPower === 'BURST1') {
      const center = cell
      const burst = Templates.cellsForBurst(center, 1, G.board)
      stage.drawTemplateCells(burst, G.board)
      preview = { template: 'burst1', cells: burst, center }
    } else if (currentPower === 'MBA') {
      const dx = Math.max(Math.abs(cell.x - attacker.x), Math.abs(cell.y - attacker.y))
      if (dx <= 1) {
        const ids = new Set([`${cell.x},${cell.y}`])
        stage.drawTemplateCells(ids, G.board)
        preview = { template: 'single', cells: ids, center: cell }
      } else {
        stage.drawTemplateCells(null, G.board)
        preview = null
      }
    } else {
      stage.drawTemplateCells(null, G.board)
      preview = null
    }
  }
})

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 't') setMode('target')
  if (e.key.toLowerCase() === 'm') setMode('move')
  if (e.key.toLowerCase() === 'g') setMode('measure')
  if (e.key === 'Escape') {
    stage.drawPathHighlight(null)
    preview = null
    measureStart = null
  }
})

// Expose helpers globally
window.findPath = Pathing.findPath
window.__Templates__ = Templates

// Initialize
loadGameState()
