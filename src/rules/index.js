import { roll } from '../engine/rng.js'
import { applyPatches } from '../engine/patches.js'
import { tickStartOfTurn, tickEndOfTurn, computeActionMaskForActor } from './effects.js'
import { applyHealing, spendSurge, secondWind, gainTempHP, deathSave, stabilize } from './healing.js'

export const initialState = (seed = 42) => {
  return {
    matchId: `match_${Date.now()}_${seed}`,
    rng: { seed, cursor: 0 },
    round: 1,
    turn: { order: [], index: 0 },
    actions: { 
      standard: 1, 
      move: 1, 
      minor: 1, 
      free: 'unbounded', 
      immediateUsedThisRound: false 
    },
    actors: {},
    board: { 
      w: 20, 
      h: 20, 
      blockers: [], 
      difficult: [], 
      positions: {} 
    },
    effects: {},
    queue: [],
    flags: { usage: {} },
    prompts: { current: null },
    log: [],
    _ts: 0
  }
}

// A3: Turn & phase semantics
export const advanceTurn = (G) => {
  const patches = []
  
  // End current turn
  if (G.turn.order.length > 0) {
    const currentActorId = G.turn.order[G.turn.index]
    const endPatches = onTurnEnd(G, currentActorId)
    patches.push(...endPatches)
  }
  
  // Advance turn index
  const nextIndex = (G.turn.index + 1) % Math.max(G.turn.order.length, 1)
  patches.push({ type: 'set', path: 'turn.index', value: nextIndex })
  
  // Increment round if we wrapped
  if (nextIndex === 0 && G.turn.order.length > 0) {
    patches.push({ type: 'inc', path: 'round', value: 1 })
    // Reset immediate usage each new round for all actors in play order
    for (const id of G.turn.order) {
      patches.push({ type: 'merge', path: `flags.usage.${id}`, value: { immediateUsedThisRound: false } })
    }
    patches.push({ 
      type: 'log', 
      value: { type: 'round-begin', msg: `Round ${G.round + 1} begins` }
    })
    const roundBeginPatches = onRoundBegin(G)
    patches.push(...roundBeginPatches)
  }
  
  // Begin next turn
  if (G.turn.order.length > 0) {
    const nextActorId = G.turn.order[nextIndex]
    const beginPatches = onTurnBegin(G, nextActorId)
    patches.push(...beginPatches)
  }
  
  return patches
}

// A3: Round hook (scaffold for future per-round resets)
export const onRoundBegin = (_G) => {
  const patches = []
  // Intentionally minimal for now; extend with per-round resets if needed
  return patches
}

export const onTurnBegin = (G, actorId) => {
  const patches = []
  let effectiveActorId = actorId

  // FIFO resolution at start of turn
  const queue = Array.isArray(G.queue) ? [...G.queue] : []
  while (queue.length > 0) {
    const entry = queue.shift()
    if (entry.type === 'delay' && entry.actorId) {
      if (entry.actorId !== actorId) {
        effectiveActorId = entry.actorId
        const idxInOrder = G.turn.order.indexOf(effectiveActorId)
        if (idxInOrder >= 0) {
          patches.push({ type: 'set', path: 'turn.index', value: idxInOrder })
        }
      }
      patches.push({ type: 'remove', path: 'queue', value: entry })
      patches.push({ type: 'log', value: { type: 'delay-resolve', actorId: entry.actorId, msg: `${entry.actorId} ends delay and acts now` } })
      // Only one entry should preempt; break after processing
      break
    }
    if (entry.type === 'ready' && entry.actorId) {
      patches.push({ type: 'remove', path: 'queue', value: entry })
      patches.push({ type: 'log', value: { type: 'ready-resolve', actorId: entry.actorId, msg: `${entry.actorId}'s readied action resolves` } })
      // Continue checking next entries; multiple ready actions can resolve sequentially before actions
      continue
    }
    // Unknown or unhandled types: stop to avoid infinite loop drift
    break
  }
  
  // Expire effects that last until the start of this actor's turn
  patches.push(...tickStartOfTurn(G, effectiveActorId))
  // Reset OA usage flags at start of each actor's turn
  patches.push({ type: 'merge', path: `flags.usage.${effectiveActorId}`, value: { opportunityUsedThisTurn: false } })
  for (const [instanceId, effect] of Object.entries(G.effects || {})) {
    const duration = effect.duration
    const matchesString = duration === 'untilStartOfTurn' && (effect.target === effectiveActorId || effect.owner === effectiveActorId)
    const matchesObj = duration && duration.kind === 'untilStartOfTurn' && duration.actorId === effectiveActorId
    if (matchesString || matchesObj) {
      patches.push({ type: 'set', path: `effects.${instanceId}`, value: undefined })
      patches.push({ type: 'log', value: { type: 'effect-expire', msg: `Effect ${instanceId} ends at start of ${effectiveActorId}'s turn` } })
    }
  }

  // Reset actions
  patches.push({ type: 'set', path: 'actions', value: { 
    standard: 1, 
    move: 1, 
    minor: 1, 
    free: 'unbounded', 
    immediateUsedThisRound: false 
  }})
  
  // Apply dazed/stunned effects (simplified) - only if actorId exists
  if (effectiveActorId && G.actors[effectiveActorId]) {
    const actor = G.actors[effectiveActorId]
    const mask = computeActionMaskForActor(G, effectiveActorId)
    patches.push({ type: 'set', path: 'actions', value: { 
      standard: mask.standard, 
      move: mask.move, 
      minor: mask.minor, 
      free: 'unbounded', 
      immediateUsedThisRound: false 
    }})
    
    patches.push({ 
      type: 'log', 
      value: { type: 'turn-begin', actorId: effectiveActorId, msg: `${effectiveActorId}'s turn begins` }
    })
  }
  
  return patches
}

export const onTurnEnd = (G, actorId) => {
  const patches = []
  
  // Run save-ends for this actor
  const savePatches = runEndOfTurnSaves(G, actorId)
  patches.push(...savePatches)
  patches.push(...tickEndOfTurn(G, actorId))
  // G7: Death save at end of target's turn if dying and not stabilized
  const actor = G.actors && G.actors[actorId]
  const dying = actor && actor.flags && actor.flags.dying
  const stabilized = actor && actor.death && actor.death.stabilized
  if (dying && !stabilized) {
    const res = deathSave(G, actorId)
    patches.push(...res.patches)
  }
  
  // Expire effects that last until the end of this actor's turn
  for (const [instanceId, effect] of Object.entries(G.effects || {})) {
    const duration = effect.duration
    const matchesString = duration === 'untilEndOfTurn' && (effect.target === actorId || effect.owner === actorId)
    const matchesObj = duration && duration.kind === 'untilEndOfTurn' && duration.actorId === actorId
    if (matchesString || matchesObj) {
      patches.push({ type: 'set', path: `effects.${instanceId}`, value: undefined })
      patches.push({ type: 'log', value: { type: 'effect-expire', msg: `Effect ${instanceId} ends at end of ${actorId}'s turn` } })
    }
  }

  patches.push({ 
    type: 'log', 
    value: { type: 'turn-end', actorId, msg: `${actorId}'s turn ends` }
  })
  
  return patches
}

// A4: Duration model & saves
export const runEndOfTurnSaves = (G, targetId) => {
  const patches = []
  
  // Find all save-ends effects on this target
  for (const [instanceId, effect] of Object.entries(G.effects)) {
    if (effect.target === targetId && effect.duration === 'saveEnds') {
      const { result, patches: rngPatches } = roll(G, 'd20')
      const success = result >= 10
      // Apply RNG cursor/log patches as part of this resolution
      patches.push(...(rngPatches || []))
      
      patches.push({ 
        type: 'log', 
        value: { 
          type: 'save', 
          actorId: targetId, 
          msg: `${targetId} saves vs ${effect.condition} (${result})`,
          data: { effect: effect.condition, result, success }
        }
      })
      
      if (success) {
        patches.push({ type: 'set', path: `effects.${instanceId}`, value: undefined })
      }
    }
  }
  
  return patches
}

// A8: Rules kernel surface
export const canSpendAction = (G, kind) => {
  const actions = G.actions
  
  if (kind === 'standard' && actions.standard > 0) return { ok: true }
  if (kind === 'move') {
    if (actions.move > 0) return { ok: true }
    // Swap: standard → move
    if (actions.standard > 0) return { ok: true, swap: { from: 'standard', to: 'move' } }
    return { ok: false, reason: 'No move or standard action available' }
  }
  if (kind === 'minor') {
    if (actions.minor > 0) return { ok: true }
    // Swap: move → minor
    if (actions.move > 0) return { ok: true, swap: { from: 'move', to: 'minor' } }
    // Swap: standard → minor
    if (actions.standard > 0) return { ok: true, swap: { from: 'standard', to: 'minor' } }
    return { ok: false, reason: 'No minor, move, or standard action available' }
  }
  if (kind === 'free') return { ok: true }
  
  return { ok: false, reason: `No ${kind} action available` }
}

export const spendAction = (G, kind) => {
  const { ok, reason, swap } = canSpendAction(G, kind)
  if (!ok) {
    return [{ 
      type: 'log', 
      value: { type: 'info', msg: `Warning: ${reason}` }
    }]
  }
  
  const patches = []
  
  if (kind === 'standard') {
    patches.push({ type: 'inc', path: 'actions.standard', value: -1 })
  } else if (kind === 'move') {
    if (swap && swap.from === 'standard') {
      patches.push({ type: 'inc', path: 'actions.standard', value: -1 })
    } else {
      patches.push({ type: 'inc', path: 'actions.move', value: -1 })
    }
  } else if (kind === 'minor') {
    if (swap && swap.from === 'move') {
      patches.push({ type: 'inc', path: 'actions.move', value: -1 })
    } else if (swap && swap.from === 'standard') {
      patches.push({ type: 'inc', path: 'actions.standard', value: -1 })
    } else {
      patches.push({ type: 'inc', path: 'actions.minor', value: -1 })
    }
  }
  
  patches.push({ 
    type: 'log', 
    value: { type: 'info', msg: swap ? `Spent ${swap.from} as ${kind}` : `Spent ${kind} action` }
  })
  
  return patches
}

// Boardgame.io integration
export const firstPlayer = (_G, _ctx) => 0
export const nextPlayer = (G, ctx) => {
  const { playOrderPos, playOrder } = ctx
  return (playOrderPos + 1) % playOrder.length
}
export const canEndTurn = (G, _ctx) => !G.prompts.current

// Re-export for boardgame.io integration
export { applyPatches, roll }
export { applyHealing, spendSurge, secondWind, gainTempHP, deathSave, stabilize }

// Initiative utilities
export const setInitiativeOrder = (_G, order) => ([
  { type: 'set', path: 'turn.order', value: order },
  { type: 'set', path: 'turn.index', value: 0 },
  { type: 'log', value: { type: 'info', msg: `Initiative set: ${order.join(', ')}` } }
])

export const insertActorIntoInitiative = (G, actorId, position = G.turn.order.length) => {
  const order = [...G.turn.order]
  const clamped = Math.max(0, Math.min(position, order.length))
  if (order.includes(actorId)) {
    return [{ type: 'log', value: { type: 'info', msg: `${actorId} already in initiative` } }]
  }
  order.splice(clamped, 0, actorId)
  return [
    { type: 'set', path: 'turn.order', value: order },
    { type: 'log', value: { type: 'info', msg: `Inserted ${actorId} at ${clamped}` } }
  ]
}

export const removeActorFromInitiative = (G, actorId) => {
  const order = G.turn.order.filter(id => id !== actorId)
  const patches = [{ type: 'set', path: 'turn.order', value: order }]
  patches.push({ type: 'log', value: { type: 'info', msg: `Removed ${actorId} from initiative` } })
  // Adjust index if necessary
  const currentIdx = G.turn.index
  if (currentIdx >= order.length) {
    patches.push({ type: 'set', path: 'turn.index', value: Math.max(0, order.length - 1) })
  }
  return patches
}

// Effects helpers
export const addEffect = (G, effect) => {
  const nextSeq = Object.keys(G.effects || {}).length + 1
  const instanceId = `e_${G._ts + 1}_${nextSeq}`
  const value = { id: instanceId, ...effect }
  return [
    { type: 'set', path: `effects.${instanceId}`, value },
    { type: 'log', value: { type: 'effect-add', msg: `Effect applied: ${effect.condition || effect.kind || instanceId}`, data: { id: instanceId } } }
  ]
}

// Movement preview/commit
import { findPath as _findPath } from '../tactics/pathing.js'
import { neighbors8 as _neighbors8, toId as _gridToId, inBounds as _inBounds, chebyshev as _chebyshev } from '../tactics/grid.js'
import { toId as _toId, detectOAFromMovement as _detectOA } from '../tactics/grid.js'
import { normalizeTemplateSpec as _normTemplate, normalizeTargetingSpec as _normTarget } from '../tactics/specs.js'
import { computeFlagsForActor as _computeFlagsForActor } from './effects.js'

export const previewMove = (G, actorId, toCell, mode = 'walk', opts = {}) => {
  const from = G.board.positions[actorId]
  if (!from) return { ok: false, reason: 'no-position' }
  const baseSpeed = (G.actors[actorId] && G.actors[actorId].speed) || 6
  const speedBonus = mode === 'run' ? (opts.speedBonus ?? 2) : 0
  const flags = _computeFlagsForActor(G, actorId)
  if (flags.speed0) {
    if (mode === 'shift' || mode === 'walk' || mode === 'run') return { ok: false, reason: 'speed0' }
  }
  let maxBudget = baseSpeed + speedBonus
  if (flags.slowCap2) maxBudget = Math.min(maxBudget, 2)
  if (mode === 'shift') {
    // Exactly 1 step and not into difficult terrain
    const dx = Math.abs(toCell.x - from.x), dy = Math.abs(toCell.y - from.y)
    if (Math.max(dx, dy) !== 1) return { ok: false, reason: 'shift-distance' }
    if (flags.cannotShift) return { ok: false, reason: 'cannot-shift' }
    const toId = _toId(toCell)
    if ((G.board.difficult || []).includes(toId)) return { ok: false, reason: 'difficult' }
  }
  const res = _findPath(G, from, toCell)
  if (!res) return { ok: false, reason: 'blocked' }
  if (mode === 'shift' && res.path.length !== 2) return { ok: false, reason: 'shift-path' }
  const warns = []
  if (res.cost > maxBudget) {
    warns.push({ type: 'range', cost: res.cost, max: maxBudget })
  }
  const oa = _detectOA(G, actorId, res.path)
  if (oa.provokers.length > 0 && mode !== 'shift') {
    warns.push({ type: 'oa', provokers: oa.provokers, cells: oa.cells })
  }
  return { ok: true, path: res.path, cost: res.cost, warns }
}

export const commitMove = (G, actorId, preview) => {
  if (!preview || !preview.ok) return [{ type: 'log', value: { type: 'info', msg: 'Invalid move commit' } }]
  const to = preview.path[preview.path.length - 1]
  return [
    { type: 'set', path: `board.positions.${actorId}`, value: to },
    { type: 'inc', path: 'actions.move', value: -1 },
    { type: 'log', value: { type: 'move-commit', msg: `Moved ${actorId} to ${to.x},${to.y}`, data: { actorId, from: preview.path[0], to, path: preview.path, cost: preview.cost } } }
  ]
}

export const buildMovePreviewLog = (actorId, preview, mode = 'walk') => {
  if (!preview || !preview.path) return [{ type: 'log', value: { type: 'move-preview', msg: `Preview invalid for ${actorId}`, data: { actorId, ok: false } } }]
  return [{ type: 'log', value: { type: 'move-preview', msg: `Preview ${mode} for ${actorId}`, data: { actorId, mode, from: preview.path[0], to: preview.path[preview.path.length - 1], path: preview.path, cost: preview.cost, warns: preview.warns || [] } } }]
}

// C10–C12: Targeting preview logs and staging patches
export const buildTargetPreviewLog = (attackerId, spec, preview, choices = {}) => {
  const tSpec = _normTemplate(spec)
  const data = {
    attackerId,
    spec: { kind: tSpec.kind, origin: tSpec.origin, radius: tSpec.radius, size: tSpec.size, range: tSpec.range },
    center: choices.center || null,
    facing: choices.facing || null,
    templateCellsCount: preview && preview.templateCells ? preview.templateCells.size : 0,
    candidateCount: preview && preview.targets ? preview.targets.length : 0,
    errors: preview && preview.errors || [],
    warnings: preview && preview.warnings || []
  }
  return [{ type: 'log', value: { type: 'target-preview', msg: `Target preview by ${attackerId}`, data } }]
}

export const stageTargetingSelection = (G, attackerId, spec, choices = {}, selectedTargets = []) => {
  const tSpec = _normTemplate(spec)
  const patches = []
  patches.push({ type: 'set', path: 'staging.targeting', value: {
    attackerId,
    spec: { kind: tSpec.kind, origin: tSpec.origin, radius: tSpec.radius, size: tSpec.size, range: tSpec.range },
    center: choices.center || null,
    facing: choices.facing || null,
    targets: selectedTargets
  }})
  patches.push({ type: 'log', value: { type: 'template-choose', msg: `${attackerId} staged targeting`, data: { attackerId, targets: selectedTargets, center: choices.center || null, facing: choices.facing || null } } })
  return patches
}

export const move = {
  walk(G, actorId, toCell) {
    const pv = previewMove(G, actorId, toCell, 'walk')
    if (!pv.ok) return [{ type: 'log', value: { type: 'info', msg: `Walk blocked: ${pv.reason}` } }]
    return [
      ...buildMovePreviewLog(actorId, pv, 'walk'),
      ...commitMove(G, actorId, pv)
    ]
  },
  shift(G, actorId, toCell) {
    const pv = previewMove(G, actorId, toCell, 'shift')
    if (!pv.ok) return [{ type: 'log', value: { type: 'info', msg: `Shift blocked: ${pv.reason}` } }]
    return [
      ...buildMovePreviewLog(actorId, pv, 'shift'),
      ...commitMove(G, actorId, pv)
    ]
  },
  run(G, actorId, toCell, speedBonus = 2) {
    const pv = previewMove(G, actorId, toCell, 'run', { speedBonus })
    if (!pv.ok) return [{ type: 'log', value: { type: 'info', msg: `Run blocked: ${pv.reason}` } }]
    return [
      ...buildMovePreviewLog(actorId, pv, 'run'),
      ...commitMove(G, actorId, pv),
      { type: 'merge', path: 'flags', value: { ranThisTurn: true } },
      { type: 'log', value: { type: 'run-flag', msg: `${actorId} ran`, data: { bonus: speedBonus } } }
    ]
  },
  standUp(G, actorId) {
    const actor = G.actors[actorId] || {}
    if (!actor.conditions || !actor.conditions.includes('prone')) {
      return [{ type: 'log', value: { type: 'info', msg: `${actorId} is not prone` } }]
    }
    const newConds = actor.conditions.filter(c => c !== 'prone')
    return [
      { type: 'set', path: `actors.${actorId}.conditions`, value: newConds },
      { type: 'inc', path: 'actions.move', value: -1 },
      { type: 'log', value: { type: 'stand', msg: `${actorId} stands up` } }
    ]
  }
}

// B7: Forced movement (push/pull/slide)
const _isBlockedCell = (G, cell) => {
  const id = _gridToId(cell)
  const blockers = new Set(G.board.blockers || [])
  return blockers.has(id)
}

const _isOccupied = (G, cell) => {
  const id = _gridToId(cell)
  for (const pos of Object.values(G.board.positions || {})) {
    if (_gridToId(pos) === id) return true
  }
  return false
}

const _forcedLegal = (G, cell, isFinal) => {
  if (!_inBounds(cell, G.board)) return false
  if (_isBlockedCell(G, cell)) return false
  if (isFinal && _isOccupied(G, cell)) return false
  // Passing through occupied cells is allowed for MVP (treat as ally pass-through)
  return true
}

export const forced = {
  push(G, sourceId, targetId, n) {
    const source = G.board.positions[sourceId]
    const start = G.board.positions[targetId]
    if (!source || !start) return [{ type: 'log', value: { type: 'info', msg: 'Invalid push: missing positions' } }]
    let current = start
    const path = [current]
    for (let i = 0; i < n; i++) {
      const step = {
        x: Math.sign(current.x - source.x),
        y: Math.sign(current.y - source.y)
      }
      const next = { x: current.x + step.x, y: current.y + step.y }
      if (!_forcedLegal(G, next, i === n - 1)) break
      current = next
      path.push(current)
    }
    const final = path[path.length - 1]
    const patches = []
    if (final.x !== start.x || final.y !== start.y) {
      patches.push({ type: 'set', path: `board.positions.${targetId}`, value: final })
    }
    patches.push({ type: 'log', value: { type: 'forced-move', msg: `${targetId} pushed`, data: { kind: 'push', sourceId, targetId, n, path } } })
    return patches
  },
  pull(G, sourceId, targetId, n) {
    const source = G.board.positions[sourceId]
    const start = G.board.positions[targetId]
    if (!source || !start) return [{ type: 'log', value: { type: 'info', msg: 'Invalid pull: missing positions' } }]
    let current = start
    const path = [current]
    for (let i = 0; i < n; i++) {
      if (_chebyshev(current, source) <= 1) break
      const neigh = _neighbors8(current)
      const curD = _chebyshev(current, source)
      const candidates = neigh
        .filter(c => _chebyshev(c, source) < curD)
        .sort((a, b) => _chebyshev(a, source) - _chebyshev(b, source))
      let moved = false
      for (const c of candidates) {
        if (_forcedLegal(G, c, i === n - 1)) {
          current = c
          path.push(current)
          moved = true
          break
        }
      }
      if (!moved) break
    }
    const final = path[path.length - 1]
    const patches = []
    if (final.x !== start.x || final.y !== start.y) {
      patches.push({ type: 'set', path: `board.positions.${targetId}`, value: final })
    }
    patches.push({ type: 'log', value: { type: 'forced-move', msg: `${targetId} pulled`, data: { kind: 'pull', sourceId, targetId, n, path } } })
    return patches
  },
  slide(G, _sourceId, targetId, n, chooser) {
    const start = G.board.positions[targetId]
    if (!start) return [{ type: 'log', value: { type: 'info', msg: 'Invalid slide: missing position' } }]
    let current = start
    const path = [current]
    for (let i = 0; i < n; i++) {
      const neigh = _neighbors8(current)
      let next = null
      if (typeof chooser === 'function') {
        next = chooser(current, neigh)
      }
      // Fallback: try neighbors in order
      const options = next ? [next, ...neigh.filter(c => c.x !== next.x || c.y !== next.y)] : neigh
      let moved = false
      for (const c of options) {
        if (_forcedLegal(G, c, i === n - 1)) {
          current = c
          path.push(current)
          moved = true
          break
        }
      }
      if (!moved) break
    }
    const final = path[path.length - 1]
    const patches = []
    if (final.x !== start.x || final.y !== start.y) {
      patches.push({ type: 'set', path: `board.positions.${targetId}`, value: final })
    }
    patches.push({ type: 'log', value: { type: 'forced-move', msg: `${targetId} slid`, data: { kind: 'slide', targetId, n, path } } })
    return patches
  }
}

// Delay/Ready scaffolds
export const delayTurn = (G) => {
  const actorId = G.turn.order[G.turn.index]
  const patches = []
  patches.push({ type: 'add', path: 'queue', value: { type: 'delay', actorId, round: G.round } })
  patches.push({ type: 'log', value: { type: 'delay', actorId, msg: `${actorId} delays their turn` } })
  return patches
}

export const readyAction = (G, trigger) => {
  const actorId = G.turn.order[G.turn.index]
  const patches = []
  // Consume standard action for readying by default
  patches.push(...spendAction(G, 'standard'))
  patches.push({ type: 'add', path: 'queue', value: { type: 'ready', actorId, trigger, round: G.round } })
  patches.push({ type: 'log', value: { type: 'ready', actorId, msg: `${actorId} readies an action (${trigger || 'unspecified'})` } })
  return patches
}
