import { PixiStage } from './stage.js'
// Boardgame.io client glue (minimal)
import { Client } from 'https://esm.sh/boardgame.io@0.50.2/client'
import { SocketIO } from 'https://esm.sh/boardgame.io@0.50.2/multiplayer'
import { FourEGame } from '../../src/engine/game.js'
// Fallback shim for local UI without bundling

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
const btnOverride = document.getElementById('btn-override')
const btnHelp = document.getElementById('btn-help')
const elPrompt = document.getElementById('prompt')
const elOverride = document.getElementById('override')
const elOverrideJson = document.getElementById('override-json')
const elOverrideApply = document.getElementById('override-apply')
const elOverrideClose = document.getElementById('override-close')
const elHelp = document.getElementById('help')
const elHelpClose = document.getElementById('help-close')
const elPromptTitle = document.getElementById('prompt-title')
const elPromptBody = document.getElementById('prompt-body')
const elPromptUse = document.getElementById('prompt-use')
const elPromptSkip = document.getElementById('prompt-skip')

let openPrompt = null
function closePrompt() {
  openPrompt = null
  elPrompt.style.display = 'none'
  elEnd.disabled = false
}
elPromptUse.onclick = () => {
  if (!openPrompt) return
  appendLog('oa-resolve', `OA used by ${openPrompt.provokers[0]} on ${openPrompt.moverId}`)
  closePrompt()
}
elPromptSkip.onclick = () => {
  if (!openPrompt) return
  appendLog('oa-skip', `OA skipped by ${openPrompt.provokers.join(', ')}`)
  closePrompt()
}

btnOverride.onclick = () => {
  elOverride.style.display = 'block'
}
elOverrideClose.onclick = () => { elOverride.style.display = 'none' }
elOverrideApply.onclick = () => {
  try {
    const patch = JSON.parse(elOverrideJson.value || '{}')
    // dispatch to server-authoritative move
    bgioClient && bgioClient.moves && bgioClient.moves.applyManualPatch && bgioClient.moves.applyManualPatch(patch)
    appendLog('manual-override', `Applied ${patch.type} ${patch.path}`)
  } catch (e) { appendLog('error', `Invalid JSON`) }
}

btnHelp.onclick = () => { elHelp.style.display = 'block' }
elHelpClose.onclick = () => { elHelp.style.display = 'none' }
const btnMove = document.getElementById('btn-mode-move')
const btnMeasure = document.getElementById('btn-mode-measure')
const btnSecondWind = document.getElementById('btn-second-wind')

let mode = 'move' // 'move' | 'measure' | 'target'
let selected = null
let preview = null
let facingIdx = 0
let measureStart = null
let currentPower = null // 'MBA' | 'BURST1' | 'BLAST3'

let G
let bgioClient

// Use real game so client reducer matches server (stateID, move args)

async function createMatchAndJoin() {
  const gameName = '4e'
  // Create match
  const res = await fetch(`/games/${gameName}/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numPlayers: 1 }) })
  const data = await res.json().catch(() => ({}))
  const matchID = data.matchID || 'local'
  // Join as player 0 to get credentials
  let credentials = undefined
  try {
    const joinRes = await fetch(`/games/${gameName}/${matchID}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerID: '0', playerName: 'Player' }) })
    if (!joinRes.ok) {
      const txt = await joinRes.text().catch(() => '')
      console.warn('Join failed:', joinRes.status, txt)
    } else {
      const joinData = await joinRes.json().catch(() => ({}))
      credentials = joinData.playerCredentials
    }
  } catch (e) { console.warn('Join error:', e) }
  return { matchID, credentials }
}

async function startClient() {
  const { matchID, credentials } = await createMatchAndJoin()
  bgioClient = Client({
    game: FourEGame,
    multiplayer: SocketIO({ server: window.location.origin }),
    matchID,
    playerID: '0',
    credentials,
    debug: false,
    // Ensure client starts from server state to avoid stateID mismatch on first move
    // sync: 'always' mode is not exposed here; relying on initial store state before enabling moves
  })
  bgioClient.start()
  let isReady = false
  const sync = () => {
    const s = bgioClient.store?.getState?.()
    if (s && s.G) { G = s.G; renderAll() }
    // Only ready after initial sync with stateID 0 and positions present
    if (!isReady && s && typeof s._stateID === 'number' && s._stateID === 0 && s.G && s.G.board && s.G.board.positions && Object.keys(s.G.board.positions).length > 0) {
      isReady = true
    }
  }
  sync()
  bgioClient.store.subscribe(sync)
  // expose readiness for guards
  window.__BGIO_READY__ = () => isReady
}

startClient()

const stage = new PixiStage(elStage)
if (G && G.board) {
  stage.drawGrid(G.board)
  stage.drawTokens(G)
}

function appendLog(type, msg){
  const div = document.createElement('div')
  div.className = `entry ${type}`
  const icon = document.createElement('span')
  icon.className = 'icon'
  icon.textContent = type === 'attack-roll' ? '🎲' : type === 'damage-apply' ? '💥' : type === 'save' ? '🛡' : type === 'manual-override' ? '✏️' : '•'
  const msgEl = document.createElement('span')
  msgEl.className = 'msg'
  const ts = ((G && G._ts) ? (G._ts + 1) : 1)
  msgEl.textContent = `[${ts}] ${msg}`
  div.appendChild(icon)
  div.appendChild(msgEl)
  elLog.appendChild(div)
  elLog.scrollTop = elLog.scrollHeight
}

function renderPanel(){
  if (!G || !G.turn || !Array.isArray(G.turn.order)) return
  // initiative list
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
  const hp = actor.hp || { current:0, max:0, temp:0 }
  elHp.textContent = `${hp.current}/${hp.max}`
  elThp.textContent = `${hp.temp}`
  const surges = actor.surges || { remaining:0, value:0 }
  elSurges.textContent = `${surges.remaining} (${surges.value})`
  const actions = G.actions || { standard:0, move:0, minor:0 }
  elStd.textContent = actions.standard
  elMov.textContent = actions.move
  elMin.textContent = actions.minor
  // simple powers list
  const powersDivId = 'powers'
  let powersDiv = document.getElementById(powersDivId)
  if (!powersDiv) { powersDiv = document.createElement('div'); powersDiv.id = powersDivId; document.getElementById('panel').appendChild(powersDiv) }
  powersDiv.innerHTML = ''
  const p1 = document.createElement('button'); p1.className = 'btn'; p1.style.marginRight = '6px'; p1.textContent = 'MBA'; p1.onclick = () => { currentPower = 'MBA'; setMode('target'); appendLog('info', 'Target mode for MBA') }
  const p2 = document.createElement('button'); p2.className = 'btn'; p2.textContent = 'Burst 1'; p2.onclick = () => { currentPower = 'BURST1'; setMode('target'); appendLog('info', 'Target mode for Burst 1') }
  powersDiv.appendChild(p1); powersDiv.appendChild(p2)
}

function renderAll(){
  if (!G) return
  stage.drawGrid(G.board)
  stage.drawTokens(G)
  renderPanel()
}

function updateTokens(){ stage.drawTokens(G) }

function setMode(m){ mode = m; appendLog('mode', `Mode: ${m}`) }

btnMove.onclick = () => setMode('move')
btnMeasure.onclick = () => setMode('measure')
// Temporary: press T to enter target mode
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 't') setMode('target') })
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'm') setMode('move') })
window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'g') setMode('measure') })
btnSecondWind.onclick = () => {
  const id = selected || (G && G.turn && G.turn.order[G.turn.index])
  if (!id) return
  bgioClient && bgioClient.moves && bgioClient.moves.useSecondWind && bgioClient.moves.useSecondWind(id)
}

elEnd.onclick = () => {
  // Server-authoritative end turn
  bgioClient && bgioClient.moves && bgioClient.moves.endTurn && bgioClient.moves.endTurn()
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
    if (!(window.__BGIO_READY__ && window.__BGIO_READY__())) return
    const { findPath } = window
    const from = G.board.positions[selected]
    if (!from) return
    const res = findPath(G, from, cell)
    if (res && res.path && res.path.length > 1) stage.drawPathHighlight(res.path)
    else stage.drawPathHighlight(null)
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
    if (!(window.__BGIO_READY__ && window.__BGIO_READY__())) return
    const { findPath } = window
    const res = findPath(G, G.board.positions[selected], cell)
    if (!res) { appendLog('warn', 'Path blocked'); return }
    // commit immediately for simplicity
    const to = res.path[res.path.length - 1]
    console.log('dispatch moveToken (click)', { actorId: selected, toX: to.x, toY: to.y, mode: 'walk' })
    // Server-authoritative: call move with object payload to avoid signature drift
    bgioClient && bgioClient.moves && bgioClient.moves.moveToken && bgioClient.moves.moveToken({ actorId: selected, toX: to.x, toY: to.y, mode: 'walk' })
    appendLog('move-commit', `${selected} -> ${to.x},${to.y} (cost ${res.cost})`)
    stage.drawPathHighlight(null)
  } else if (mode === 'target') {
    const attacker = G.board.positions[selected]
    if (!attacker) return
    const { cellsForBurst, cellsForBlast, FACINGS8 } = window.__Templates__
    if (currentPower === 'BURST1') {
      const center = cell
      const burst = cellsForBurst(center, 1, G.board)
      stage.drawTemplateCells(burst, G.board)
      preview = { template: 'burst1', cells: burst, center }
    } else if (currentPower === 'MBA') {
      // Melee basic: single target within 1 of attacker -> highlight only that target cell
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
      // default: no template
      stage.drawTemplateCells(null, G.board)
      preview = null
    }
  }
})

// Confirm move with Enter
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && preview && selected && mode === 'move') {
    if (!(window.__BGIO_READY__ && window.__BGIO_READY__())) return
    const to = preview.path[preview.path.length - 1]
    console.log('dispatch moveToken (enter)', { actorId: selected, toX: to.x, toY: to.y, mode: 'walk' })
    // Dispatch object payload
    bgioClient && bgioClient.moves && bgioClient.moves.moveToken && bgioClient.moves.moveToken({ actorId: selected, toX: to.x, toY: to.y, mode: 'walk' })
    stage.drawPathHighlight(null)
    preview = null
  }
  if (e.key === 'Escape') {
    stage.drawPathHighlight(null)
    preview = null
    measureStart = null
  }
  if (mode === 'target' && (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'e')) {
    const dir = e.key.toLowerCase() === 'q' ? -1 : 1
    facingIdx = (facingIdx + dir + 8) % 8
    // Redraw a blast from attacker with new facing for preview
    const attacker = G.board.positions[selected]
    const { cellsForBlast, FACINGS8 } = window.__Templates__
    const facing = FACINGS8[facingIdx]
    const cells = cellsForBlast(attacker, facing, 3, G.board)
    stage.drawTemplateCells(cells, G.board)
  }
})

// Expose pathing helpers
import * as Pathing from './pathing.js'
window.findPath = Pathing.findPath
import * as Templates from './templates.js'
window.__Templates__ = Templates

// initial render waits for store sync


