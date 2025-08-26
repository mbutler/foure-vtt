import { roll } from '../engine/rng.js'

// E1: create effect instance id
const nextEffectId = (G) => {
  const seq = Object.keys(G.effects || {}).length + 1
  return `e_${G._ts + 1}_${seq}`
}

export const makeEffectInstance = (G, { conditionId, source, target, duration, data }) => {
  return {
    id: nextEffectId(G),
    conditionId,
    source,
    target,
    duration, // e.g., 'saveEnds' | 'endOfSourceNext' | 'startOfSourceNext' | 'encounter'
    appliedAt: { round: G.round, turnActorId: (G.turn.order && G.turn.order[G.turn.index]) || null },
    data: data || {},
    meta: {}
  }
}

// E3: attach condition (replace same-named on target)
export const applyCondition = (G, { conditionId, source, target, duration, data }) => {
  const patches = []
  // remove existing with same conditionId
  for (const [id, eff] of Object.entries(G.effects || {})) {
    if (eff.target === target && eff.conditionId === conditionId) {
      patches.push(...removeCondition(G, id))
    }
  }
  const inst = makeEffectInstance(G, { conditionId, source, target, duration, data })
  patches.push({ type: 'set', path: `effects.${inst.id}`, value: inst })
  const list = ((G.actors && G.actors[target] && G.actors[target].conditions) || [])
  patches.push({ type: 'set', path: `actors.${target}.conditions`, value: [...list, inst.id] })
  patches.push({ type: 'log', value: { type: 'condition-add', msg: `${conditionId} applied to ${target}`, data: { instanceId: inst.id, conditionId, source, target, duration } } })
  return { patches, instanceId: inst.id }
}

export const removeCondition = (G, instanceId) => {
  const patches = []
  const inst = G.effects && G.effects[instanceId]
  if (!inst) return patches
  // remove from actor list
  const actor = G.actors && G.actors[inst.target]
  if (actor && Array.isArray(actor.conditions)) {
    const filtered = actor.conditions.filter(id => id !== instanceId)
    patches.push({ type: 'set', path: `actors.${inst.target}.conditions`, value: filtered })
  }
  patches.push({ type: 'set', path: `effects.${instanceId}`, value: undefined })
  patches.push({ type: 'log', value: { type: 'condition-remove', msg: `${inst.conditionId} removed from ${inst.target}`, data: { instanceId } } })
  return patches
}

// E5: saving throw vs saveEnds (10+)
export const savingThrow = (G, instanceId) => {
  const inst = G.effects && G.effects[instanceId]
  if (!inst) return { success: false, patches: [] }
  const patches = []
  const r = roll(G, 'd20')
  patches.push(...(r.patches || []))
  const success = r.result >= 10
  patches.push({ type: 'log', value: { type: 'save-roll', msg: `Save vs ${inst.conditionId}`, data: { target: inst.target, instanceId, d20: r.result, success, rng: { seed: G.rng.seed, idx: G.rng.cursor } } } })
  patches.push({ type: 'log', value: { type: success ? 'save-success' : 'save-fail', msg: success ? `Save succeeds` : `Save fails`, data: { instanceId } } })
  if (success) patches.push(...removeCondition(G, instanceId))
  return { success, patches }
}

// E8: apply ongoing damage at start of turn for target
import { applyDamage } from './attacks.js'
export const applyOngoingAtStart = (G, actorId) => {
  const patches = []
  for (const [id, eff] of Object.entries(G.effects || {})) {
    if (eff.target === actorId && eff.conditionId === 'ongoing-damage') {
      const amount = eff.data && eff.data.amount || 0
      const type = eff.data && eff.data.type
      patches.push({ type: 'log', value: { type: 'ongoing-apply', msg: `Ongoing ${amount}${type ? ' ' + type : ''} to ${actorId}`, data: { instanceId: id } } })
      const res = applyDamage(G, actorId, amount, type)
      patches.push(...res.patches)
    }
  }
  return patches
}

// E4: tick helpers
export const tickStartOfTurn = (G, actorId) => {
  const patches = []
  // apply ongoing
  patches.push(...applyOngoingAtStart(G, actorId))
  // expire startOfSourceNext where source === actorId
  for (const [id, eff] of Object.entries(G.effects || {})) {
    if (eff.duration === 'startOfSourceNext' && eff.source === actorId) {
      patches.push(...removeCondition(G, id))
      patches.push({ type: 'log', value: { type: 'effect-expire', msg: `Effect ${id} expired at start of source's turn`, data: { instanceId: id } } })
    }
  }
  return patches
}

export const tickEndOfTurn = (G, actorId) => {
  const patches = []
  // saveEnds on this actor
  for (const [id, eff] of Object.entries(G.effects || {})) {
    if (eff.target === actorId && eff.duration === 'saveEnds') {
      const s = savingThrow(G, id)
      patches.push(...s.patches)
    }
  }
  // expire endOfSourceNext where source === actorId
  for (const [id, eff] of Object.entries(G.effects || {})) {
    if (eff.duration === 'endOfSourceNext' && eff.source === actorId) {
      patches.push(...removeCondition(G, id))
      patches.push({ type: 'log', value: { type: 'effect-expire', msg: `Effect ${id} expired at end of source's turn`, data: { instanceId: id } } })
    }
  }
  // sustain mechanics: if effect requires sustain and target did not sustain this turn, expire
  for (const [id, eff] of Object.entries(G.effects || {})) {
    if (eff.target === actorId && eff.data && eff.data.sustain) {
      const sustainedRound = eff.meta && eff.meta.sustainedRound
      if (sustainedRound !== G.round) {
        patches.push(...removeCondition(G, id))
        patches.push({ type: 'log', value: { type: 'effect-expire', msg: `Effect ${id} expired (not sustained)`, data: { instanceId: id } } })
      }
    }
  }
  return patches
}

// E6/E7: action masks and flags
export const computeActionMaskForActor = (G, actorId) => {
  let mask = { standard: 1, move: 1, minor: 1 }
  for (const eff of Object.values(G.effects || {})) {
    if (eff.target !== actorId) continue
    if (eff.conditionId === 'dazed') mask = { standard: Math.min(mask.standard, 1), move: Math.min(mask.move, 0), minor: Math.min(mask.minor, 0) }
    if (eff.conditionId === 'stunned') mask = { standard: 0, move: 0, minor: 0 }
  }
  return mask
}

export const computeFlagsForActor = (G, actorId) => {
  const flags = { speed0: false, slowCap2: false, cannotShift: false, weakened: false, grantCA: false, hasCA: false }
  for (const eff of Object.values(G.effects || {})) {
    if (eff.target !== actorId) continue
    if (eff.conditionId === 'immobilized') flags.speed0 = true
    if (eff.conditionId === 'restrained') { flags.speed0 = true; flags.cannotShift = true; flags.grantCA = true }
    if (eff.conditionId === 'slowed') flags.slowCap2 = true
    if (eff.conditionId === 'weakened') flags.weakened = true
    if (eff.conditionId === 'blinded') flags.grantCA = true
    if (eff.conditionId === 'prone') flags.grantCA = true
    if (eff.conditionId === 'dazed' || eff.conditionId === 'stunned') flags.grantCA = true
    if (eff.conditionId === 'invisible') flags.hasCA = true
  }
  return flags
}

// E9: Mark helper
export const applyMark = (G, sourceId, targetId, duration = 'saveEnds') => {
  return applyCondition(G, { conditionId: 'marked', source: sourceId, target: targetId, duration, data: { by: sourceId } })
}

// E10: Sustain helper: spend action kind externally; mark sustainedRound
export const sustainEffect = (G, instanceId) => {
  const patches = []
  const eff = G.effects && G.effects[instanceId]
  if (!eff) return patches
  const updated = { ...(eff.meta || {}), sustainedRound: G.round }
  patches.push({ type: 'set', path: `effects.${instanceId}.meta`, value: updated })
  patches.push({ type: 'log', value: { type: 'effect-sustain', msg: `Effect ${instanceId} sustained`, data: { instanceId } } })
  return patches
}

// effect rules
