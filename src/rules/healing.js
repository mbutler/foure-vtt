import { roll } from '../engine/rng.js'

const ensureActorHealth = (G, actorId) => {
  const actor = (G.actors && G.actors[actorId]) || {}
  const hp = actor.hp || { current: 0, max: 1, temp: 0 }
  const surges = actor.surges || { remaining: 0, value: Math.max(1, Math.floor((hp.max || 1) / 4)) }
  const death = actor.death || { failures: 0, stabilized: false }
  const flags = actor.flags || {}
  return { actor, hp, surges, death, flags }
}

export const spendSurge = (G, actorId, { multiplier = 1, bonus = 0 } = {}) => {
  const { hp, surges } = ensureActorHealth(G, actorId)
  const patches = []
  let healed = 0
  if ((surges.remaining || 0) > 0) {
    healed = (surges.value || 0) * multiplier + bonus
    patches.push({ type: 'inc', path: `actors.${actorId}.surges.remaining`, value: -1 })
    patches.push({ type: 'log', value: { type: 'surge-spend', msg: `${actorId} spends a surge`, data: { actorId, value: surges.value, multiplier, bonus } } })
  } else {
    healed = 0
  }
  return { healed, patches }
}

export const applyHealing = (G, actorId, amount = 0, { requiresSurge = false, allowOverflow = true } = {}) => {
  const { hp, surges, death } = ensureActorHealth(G, actorId)
  const patches = []

  let totalHeal = Math.max(0, amount)
  let usedSurge = false

  if (requiresSurge) {
    if ((surges.remaining || 0) > 0) {
      const res = spendSurge(G, actorId, {})
      patches.push(...res.patches)
      totalHeal += res.healed
      usedSurge = true
    } else {
      // No surges: policy — this heal sets HP to at least 1
      // We still apply additional amount on top of raising to 0 first
    }
  }

  const before = { hp: hp.current || 0, temp: hp.temp || 0 }

  // If below 0, raise to 0 first before applying
  let base = hp.current || 0
  if (base < 0) base = 0
  let afterHp = base + totalHeal
  const max = hp.max || 1
  if (!allowOverflow) afterHp = Math.min(afterHp, max)

  if (requiresSurge && (surges.remaining || 0) === 0) {
    // Ensure at least 1 HP for this heal
    afterHp = Math.max(afterHp, 1)
  }

  patches.push({ type: 'set', path: `actors.${actorId}.hp.current`, value: afterHp })
  // Clear dying/stabilized on any heal that brings HP above 0
  if (afterHp > 0) {
    patches.push({ type: 'merge', path: `actors.${actorId}.flags`, value: { dying: false, dead: false } })
    patches.push({ type: 'set', path: `actors.${actorId}.death.failures`, value: 0 })
    patches.push({ type: 'set', path: `actors.${actorId}.death.stabilized`, value: false })
    patches.push({ type: 'log', value: { type: 'revive', msg: `${actorId} revived above 0 HP`, data: { hp: afterHp } } })
  }

  const bloodied = afterHp <= Math.floor(max / 2)
  patches.push({ type: 'merge', path: `actors.${actorId}`, value: { bloodied } })
  patches.push({ type: 'merge', path: `actors.${actorId}.flags`, value: { bloodied } })

  patches.push({ type: 'log', value: { type: 'heal-apply', msg: `${actorId} healed`, data: { actorId, before, after: { hp: afterHp, temp: hp.temp || 0 }, requiresSurge, usedSurge } } })
  
  return { patches }
}

export const gainTempHP = (G, actorId, amount) => {
  const { hp } = ensureActorHealth(G, actorId)
  const newTemp = Math.max(hp.temp || 0, Math.max(0, amount || 0))
  return [
    { type: 'set', path: `actors.${actorId}.hp.temp`, value: newTemp },
    { type: 'log', value: { type: 'temp-apply', msg: `${actorId} gains temp HP`, data: { amount: newTemp } } }
  ]
}

export const secondWind = (G, actorId) => {
  // Heal surge value; cap at max; set defense bonus flag until start of next turn
  const patches = []
  const { surges } = ensureActorHealth(G, actorId)
  const used = (G.actors && G.actors[actorId] && G.actors[actorId].flags && G.actors[actorId].flags.usedSecondWind) || false
  if (used) {
    patches.push({ type: 'log', value: { type: 'second-wind', msg: `${actorId} cannot Second Wind (already used)`, data: { actorId } } })
    return patches
  }
  if ((surges.remaining || 0) > 0) {
    const s = spendSurge(G, actorId, {})
    patches.push(...s.patches)
    const heal = applyHealing(G, actorId, s.healed, { requiresSurge: false, allowOverflow: false })
    patches.push(...heal.patches)
    // Set transient +2 defenses flag
    const flags = (G.actors[actorId] && G.actors[actorId].flags) || {}
    patches.push({ type: 'set', path: `actors.${actorId}.flags`, value: { ...flags, defenseBonus: 2, usedSecondWind: true } })
    patches.push({ type: 'log', value: { type: 'second-wind', msg: `${actorId} uses Second Wind (+2 defenses)`, data: { actorId } } })
  } else {
    patches.push({ type: 'log', value: { type: 'second-wind', msg: `${actorId} cannot Second Wind (no surges)`, data: { actorId } } })
  }
  return patches
}

export const deathSave = (G, actorId, options = {}) => {
  const patches = []
  const { death, surges } = ensureActorHealth(G, actorId)
  if (!((G.actors && G.actors[actorId] && G.actors[actorId].flags && G.actors[actorId].flags.dying) && !(death.stabilized))) {
    return { patches } // No-op if not dying or stabilized
  }
  let r
  if (options && typeof options.forceD20 === 'number') {
    r = { result: options.forceD20, patches: [] }
  } else {
    r = roll(G, 'd20')
    patches.push(...(r.patches || []))
  }
  let outcome = 'no-change'
  let failures = death.failures || 0
  if (r.result <= 9) {
    outcome = 'fail'
    failures += 1
    patches.push({ type: 'inc', path: `actors.${actorId}.death.failures`, value: 1 })
  } else if (r.result >= 20) {
    if ((surges.remaining || 0) > 0) {
      outcome = 'surge'
      const s = spendSurge(G, actorId, {})
      patches.push(...s.patches)
      const heal = applyHealing(G, actorId, s.healed, { requiresSurge: false, allowOverflow: false })
      patches.push(...heal.patches)
    } else {
      outcome = 'no-change'
    }
  }
  patches.push({ type: 'log', value: { type: 'death-save', msg: `${actorId} death save (${r.result})`, data: { d20: r.result, outcome, failures }, rng: { seed: G.rng.seed, idx: G.rng.cursor } } })
  // Death at 3 failures
  if (failures >= 3) {
    patches.push({ type: 'merge', path: `actors.${actorId}`, value: { flags: { ...(G.actors[actorId] && G.actors[actorId].flags || {}), dead: true, dying: false } } })
    patches.push({ type: 'log', value: { type: 'die', msg: `${actorId} dies`, data: { actorId } } })
  }
  return { patches }
}

export const stabilize = (G, targetId, healerId, { dc = 15, forceD20 } = {}) => {
  const patches = []
  let r
  if (typeof forceD20 === 'number') {
    r = { result: forceD20, patches: [] }
  } else {
    r = roll(G, 'd20')
    patches.push(...(r.patches || []))
  }
  const success = r.result >= dc
  if (success) {
    patches.push({ type: 'set', path: `actors.${targetId}.death.stabilized`, value: true })
    patches.push({ type: 'log', value: { type: 'stabilize', msg: `${healerId} stabilizes ${targetId}`, data: { targetId, healerId, dc, d20: r.result } } })
  } else {
    patches.push({ type: 'log', value: { type: 'stabilize', msg: `${healerId} fails to stabilize ${targetId}`, data: { targetId, healerId, dc, d20: r.result } } })
  }
  return { success, patches }
}


