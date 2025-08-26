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
      blockers: new Set(), 
      difficult: new Set(), 
      positions: {} 
    },
    effects: new Map(),
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
  }
  
  // Begin next turn
  if (G.turn.order.length > 0) {
    const nextActorId = G.turn.order[nextIndex]
    const beginPatches = onTurnBegin(G, nextActorId)
    patches.push(...beginPatches)
  }
  
  return patches
}

export const onTurnBegin = (G, actorId) => {
  const patches = []
  
  // Reset actions
  patches.push({ type: 'set', path: 'actions', value: { 
    standard: 1, 
    move: 1, 
    minor: 1, 
    free: 'unbounded', 
    immediateUsedThisRound: false 
  }})
  
  // Apply dazed/stunned effects (simplified)
  const actor = G.actors[actorId]
  if (actor?.conditions?.includes('dazed')) {
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
    value: { type: 'turn-begin', actorId, msg: `${actorId}'s turn begins` }
  })
  
  return patches
}

export const onTurnEnd = (G, actorId) => {
  const patches = []
  
  // Run save-ends for this actor
  const savePatches = runEndOfTurnSaves(G, actorId)
  patches.push(...savePatches)
  
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
  for (const [instanceId, effect] of G.effects) {
    if (effect.target === targetId && effect.duration === 'saveEnds') {
      const { result } = roll(G, 'd20')
      const success = result >= 10
      
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
        patches.push({ type: 'remove', path: 'effects', value: instanceId })
      }
    }
  }
  
  return patches
}

// A8: Rules kernel surface
export const canSpendAction = (G, kind) => {
  const actions = G.actions
  
  if (kind === 'standard' && actions.standard > 0) return { ok: true }
  if (kind === 'move' && actions.move > 0) return { ok: true }
  if (kind === 'minor' && actions.minor > 0) return { ok: true }
  if (kind === 'free') return { ok: true }
  
  return { ok: false, reason: `No ${kind} action available` }
}

export const spendAction = (G, kind) => {
  const { ok, reason } = canSpendAction(G, kind)
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
    patches.push({ type: 'inc', path: 'actions.move', value: -1 })
  } else if (kind === 'minor') {
    patches.push({ type: 'inc', path: 'actions.minor', value: -1 })
  }
  
  patches.push({ 
    type: 'log', 
    value: { type: 'info', msg: `Spent ${kind} action` }
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
