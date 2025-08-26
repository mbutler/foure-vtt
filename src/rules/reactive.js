import { resolveAttack } from './attacks.js'

const nextEventId = (G) => {
  const seq = (G._ts || 0) + (G.queue ? G.queue.length : 0) + 1
  return `ev_${seq}`
}

export const openOA = (G, trigger) => {
  const event = {
    id: nextEventId(G),
    kind: 'OA',
    trigger: { type: trigger.type, data: trigger.data },
    eligible: trigger.provokers || [],
    status: 'open'
  }
  return [
    { type: 'add', path: 'queue', value: event },
    { type: 'log', value: { type: 'oa-open', msg: `OA open`, data: event } }
  ]
}

export const resolveOA = (G, actorId, eventId, options = {}) => {
  const patches = []
  const usage = (G.flags && G.flags.usage && G.flags.usage[actorId]) || { opportunityUsedThisTurn: false }
  if (usage.opportunityUsedThisTurn) {
    patches.push({ type: 'log', value: { type: 'oa-resolve', msg: `OA denied (already used)`, data: { actorId, eventId } } })
    return { patches }
  }
  const ev = (G.queue || []).find(e => e.id === eventId)
  if (!ev) {
    patches.push({ type: 'log', value: { type: 'oa-resolve', msg: `OA event not found`, data: { eventId } } })
    return { patches }
  }
  const moverId = ev.trigger && ev.trigger.data && ev.trigger.data.moverId
  if (!moverId) {
    patches.push({ type: 'log', value: { type: 'oa-resolve', msg: `OA has no mover`, data: { eventId } } })
    return { patches }
  }
  // Default MBA spec
  const spec = { kind: 'melee-weapon', vs: 'AC', ability: 'STR', hit: { damage: { dice: [{ n: 1, d: 6 }], ability: 'STR', type: 'untyped' } } }
  const ctx = { attackerId: actorId, defenderId: moverId, powerId: 'MBA' }
  const res = resolveAttack(G, ctx, spec, options)
  patches.push(...res.patches)
  patches.push({ type: 'merge', path: `flags.usage.${actorId}`, value: { opportunityUsedThisTurn: true } })
  patches.push({ type: 'log', value: { type: 'oa-resolve', msg: `OA resolved by ${actorId}`, data: { eventId, actorId, targetId: moverId } } })
  return { patches }
}

export const openInterrupt = (G, trigger) => {
  const event = { id: nextEventId(G), kind: 'INTERRUPT', trigger, eligible: trigger.eligible || [], status: 'open' }
  return [ { type: 'add', path: 'queue', value: event }, { type: 'log', value: { type: 'int-open', msg: 'Interrupt open', data: event } } ]
}

export const openReaction = (G, trigger) => {
  const event = { id: nextEventId(G), kind: 'REACTION', trigger, eligible: trigger.eligible || [], status: 'open' }
  return [ { type: 'add', path: 'queue', value: event }, { type: 'log', value: { type: 'react-open', msg: 'Reaction open', data: event } } ]
}

export const resolveInterrupt = (G, actorId, eventId, choice) => {
  const patches = []
  const usage = (G.flags && G.flags.usage && G.flags.usage[actorId]) || { immediateUsedThisRound: false }
  if (usage.immediateUsedThisRound) {
    patches.push({ type: 'log', value: { type: 'int-resolve', msg: 'Interrupt denied (once per round)', data: { actorId, eventId, denied: true } } })
    return { patches }
  }
  patches.push({ type: 'merge', path: `flags.usage.${actorId}`, value: { immediateUsedThisRound: true } })
  patches.push({ type: 'log', value: { type: 'int-resolve', msg: 'Interrupt resolved', data: { actorId, eventId, choice } } })
  return { patches }
}

export const resolveReaction = (G, actorId, eventId, choice) => {
  const patches = []
  const usage = (G.flags && G.flags.usage && G.flags.usage[actorId]) || { immediateUsedThisRound: false }
  if (usage.immediateUsedThisRound) {
    patches.push({ type: 'log', value: { type: 'react-resolve', msg: 'Reaction denied (once per round)', data: { actorId, eventId, denied: true } } })
    return { patches }
  }
  patches.push({ type: 'merge', path: `flags.usage.${actorId}`, value: { immediateUsedThisRound: true } })
  patches.push({ type: 'log', value: { type: 'react-resolve', msg: 'Reaction resolved', data: { actorId, eventId, choice } } })
  return { patches }
}


