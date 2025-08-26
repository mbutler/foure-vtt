import { roll } from '../engine/rng.js'
import { applyPatches } from '../engine/patches.js'

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
    if (actor.conditions && actor.conditions.includes('dazed')) {
      patches.push({ type: 'set', path: 'actions', value: { 
        standard: 1, 
        move: 0, 
        minor: 0, 
        free: 'unbounded', 
        immediateUsedThisRound: false 
      }})
    }
    
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
