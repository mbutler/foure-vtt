import { PixiStage } from './stage.js'
// Boardgame.io client glue (minimal)
import { Client } from 'https://esm.sh/boardgame.io@0.50.2/client'
// Fallback shim for local UI without bundling
import * as Rules from './rules-shim.js'

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

function openOAPrompt(moverId, provokers) {
  openPrompt = { kind: 'OA', moverId, provokers }
  elPromptTitle.textContent = 'Opportunity Attack'
  elPromptBody.textContent = `${provokers.join(', ')} can OA ${moverId}`
  elPrompt.style.display = 'block'
  elEnd.disabled = true
}
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
    // minimal patch applier for demo
    const setAtPath = (obj, path, value) => { const keys = path.split('.'); let ref = obj; for (let i=0;i<keys.length-1;i++){ const k=keys[i]; ref[k] = ref[k] ?? {}; ref = ref[k] } ref[keys[keys.length-1]] = value }
    if (patch && patch.type === 'set' && patch.path) { setAtPath(G, patch.path, patch.value) }
    appendLog('manual-override', `Applied ${patch.type} ${patch.path}`)
    renderPanel(); updateTokens()
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

// Minimal local state until bgio client wiring (H13)
let G
const ClientGame = {
  name: '4e-client',
  setup: () => Rules.initialState(42),
  moves: {
    applyManualPatch(G, ctx, patch) {
      Rules.applyPatches(G, [patch])
    },
    spendAction(G, ctx, kind) {
      const patches = Rules.spendAction(G, kind)
      Rules.applyPatches(G, patches)
    },
    endTurn(G, ctx) {
      if (!Rules.canEndTurn(G, ctx)) return
      const patches = Rules.advanceTurn(G)
      Rules.applyPatches(G, patches)
      ctx?.events?.endTurn && ctx.events.endTurn()
    }
  }
}
const bgioClient = Client({ game: ClientGame, debug: false })
bgioClient.start()
const syncFromStore = () => {
  const s = bgioClient.store?.getState?.()
  if (s && s.G) G = s.G
}
syncFromStore()
bgioClient.store.subscribe(() => { syncFromStore(); renderAll() })

const stage = new PixiStage(elStage)
stage.drawGrid(G.board)
stage.drawTokens(G)

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
  const id = selected || G.turn.order[G.turn.index]
  const actor = G.actors[id] || {}
  elSel.textContent = id || '—'
  const hp = actor.hp || { current:0, max:0, temp:0 }
  elHp.textContent = `${hp.current}/${hp.max}`
  elThp.textContent = `${hp.temp}`
  const surges = actor.surges || { remaining:0, value:0 }
  elSurges.textContent = `${surges.remaining} (${surges.value})`
  elStd.textContent = G.actions.standard
  elMov.textContent = G.actions.move
  elMin.textContent = G.actions.minor
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
  const patches = Rules.secondWind(G, id)
  if (Array.isArray(patches)) {
    for (const p of patches) {
      bgioClient && bgioClient.moves && bgioClient.moves.applyManualPatch && bgioClient.moves.applyManualPatch(p)
    }
  }
}

elEnd.onclick = () => {
  // End turn: log end, advance index, reset actions, log begin, select new actor
  const actor = G.turn.order[G.turn.index]
  appendLog('turn-end', `${actor} ends turn`)
  G.turn.index = (G.turn.index + 1) % Math.max(G.turn.order.length, 1)
  G.actions = { standard: 1, move: 1, minor: 1, free: 'unbounded', immediateUsedThisRound: false }
  const next = G.turn.order[G.turn.index]
  selected = next
  appendLog('turn-begin', `${next} begins turn`)
  renderPanel()
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
  if (!selected) return
  const rect = stage.app.view.getBoundingClientRect()
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  const cell = stage.worldToCell(pt)
  if (mode === 'move') {
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
    const { findPath } = window
    const res = findPath(G, G.board.positions[selected], cell)
    if (!res) { appendLog('warn', 'Path blocked'); return }
    // commit immediately for simplicity
    const to = res.path[res.path.length - 1]
    // Apply patches locally via rules shim to avoid async store lag
    G = Rules.applyPatches(G, [ { type:'set', path:`board.positions.${selected}`, value: to } ])
    const actP = Rules.spendAction(G, 'move')
    G = Rules.applyPatches(G, actP)
    appendLog('move-commit', `${selected} -> ${to.x},${to.y} (cost ${res.cost})`)
    stage.drawPathHighlight(null)
    renderAll()
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
    const to = preview.path[preview.path.length - 1]
    G.board.positions[selected] = to
    appendLog('move-commit', `${selected} -> ${to.x},${to.y} (cost ${preview.cost})`)
    stage.drawPathHighlight(null)
    updateTokens()
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

renderPanel()


