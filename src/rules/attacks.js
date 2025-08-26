import { roll } from '../engine/rng.js'
import { computeFlagsForActor } from './effects.js'

// D1: Spec normalization (minimal)
export const normalizeAttackSpec = (spec = {}) => {
  const out = { kind: 'melee-weapon', vs: 'AC', ability: 'STR', proficiency: 0, enhancement: 0, reach: 1, range: 5, ...spec }
  return out
}

export const normalizeAttackContext = (ctx = {}) => {
  return {
    attackerId: ctx.attackerId,
    defenderId: ctx.defenderId,
    bonuses: { flat: 0, ...(ctx.bonuses || {}) },
    flags: { combatAdvantage: false, cover: 'none', concealment: 'none', ...(ctx.flags || {}) },
    powerId: ctx.powerId || null,
    staged: ctx.staged || null
  }
}

// D3: Compute attack bonus with parts breakdown
export const computeAttackBonus = (G, ctx, spec) => {
  const attacker = (G.actors && G.actors[ctx.attackerId]) || {}
  const abilityMods = attacker.abilityMods || { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
  const parts = []
  const abilityMod = abilityMods[spec.ability] || 0
  if (abilityMod) parts.push({ label: `${spec.ability}`, value: abilityMod })
  if (spec.proficiency) parts.push({ label: 'proficiency', value: spec.proficiency })
  if (spec.enhancement) parts.push({ label: 'enhancement', value: spec.enhancement })
  if (ctx.bonuses && ctx.bonuses.flat) parts.push({ label: 'bonuses.flat', value: ctx.bonuses.flat })
  if (ctx.flags && ctx.flags.combatAdvantage) parts.push({ label: 'combatAdvantage', value: 2 })
  // Cover/Concealment penalties (manual flags)
  if (ctx.flags && (ctx.flags.cover === 'cover' || ctx.flags.cover === 'superior')) {
    parts.push({ label: 'cover', value: ctx.flags.cover === 'superior' ? -5 : -2 })
  }
  if (ctx.flags && (ctx.flags.concealment === 'conceal' || ctx.flags.concealment === 'total')) {
    parts.push({ label: 'concealment', value: ctx.flags.concealment === 'total' ? -5 : -2 })
  }
  const total = parts.reduce((s, p) => s + p.value, 0)
  return { total, parts }
}

// D4: Roll to hit (with optional test hook forceD20)
export const rollToHit = (G, ctx, bonusResult, options = {}) => {
  let d20
  let patches = []
  if (options && typeof options.forceD20 === 'number') {
    d20 = options.forceD20
  } else {
    const r = roll(G, 'd20')
    d20 = r.result
    patches = r.patches
  }
  const autoMiss = d20 === 1
  const crit = d20 === 20
  const total = d20 + (bonusResult?.total || 0)
  return { d20, total, crit, autoMiss, patches }
}

// Helper to read defender defense value
const readDefense = (G, defenderId, vs) => {
  const def = (G.actors && G.actors[defenderId] && G.actors[defenderId].defenses) || { AC: 10, Fort: 10, Ref: 10, Will: 10 }
  return def[vs] ?? 10
}

// D5: Minimal resolveAttack orchestration (no damage yet)
export const resolveAttack = (G, ctxIn, specIn, options = {}) => {
  const spec = normalizeAttackSpec(specIn)
  const ctx = normalizeAttackContext(ctxIn)
  const patches = []

  // Compute bonus
  const bonus = computeAttackBonus(G, ctx, spec)

  // Roll
  const hitRoll = rollToHit(G, ctx, bonus, options)
  patches.push(...(hitRoll.patches || []))
  patches.push({ type: 'log', value: { type: 'attack-roll', msg: `${ctx.attackerId} attacks ${ctx.defenderId}`, data: { attackerId: ctx.attackerId, defenderId: ctx.defenderId, powerId: ctx.powerId, d20: hitRoll.d20, bonusParts: bonus.parts, total: hitRoll.total, vs: spec.vs, defense: readDefense(G, ctx.defenderId, spec.vs), rng: { seed: G.rng.seed, idx: G.rng.cursor } } } })

  // Determine result
  let outcome = 'miss'
  if (hitRoll.autoMiss) outcome = 'miss'
  else if (hitRoll.crit) outcome = 'crit'
  else outcome = hitRoll.total >= readDefense(G, ctx.defenderId, spec.vs) ? 'hit' : 'miss'
  const reason = hitRoll.autoMiss ? 'NAT1' : hitRoll.crit ? 'NAT20' : (outcome === 'hit' ? 'TOTAL>=DEFENSE' : 'TOTAL<DEFENSE')

  patches.push({ type: 'log', value: { type: 'attack-result', msg: `${outcome.toUpperCase()} vs ${spec.vs}`, data: { attackerId: ctx.attackerId, defenderId: ctx.defenderId, outcome, reason } } })

  // Damage (minimal): use spec.hit.damage or spec.miss.damage
  const damageSpec = outcome === 'hit' || outcome === 'crit' ? spec.hit && spec.hit.damage : spec.miss && spec.miss.damage
  if (damageSpec) {
    const flags = computeFlagsForActor(G, ctx.attackerId)
    const dmg = evaluateDamage(G, ctx, damageSpec, { crit: outcome === 'crit', onMiss: outcome === 'miss', weakened: flags.weakened })
    patches.push(...dmg.patches)
    const applied = applyDamage(G, ctx.defenderId, dmg.total, damageSpec.type)
    patches.push(...applied.patches)
  }

  return { patches }
}

// D8: Multi-target sequencing helper
export const resolveAttackMulti = (G, ctxIn, specIn, options = {}) => {
  const targets = (ctxIn.staged && Array.isArray(ctxIn.staged.targets)) ? ctxIn.staged.targets : (Array.isArray(ctxIn.defenderIds) ? ctxIn.defenderIds : [ctxIn.defenderId])
  let allPatches = []
  for (const defenderId of targets) {
    const res = resolveAttack(G, { ...ctxIn, defenderId }, specIn, options)
    // Apply as we go so RNG cursor/logs advance deterministically per target
    allPatches.push(...res.patches)
  }
  return { patches: allPatches }
}

// Attack preview builder/log (D10)
export const buildAttackPreview = (G, ctxIn, specIn) => {
  const spec = normalizeAttackSpec(specIn)
  const ctx = normalizeAttackContext(ctxIn)
  const bonus = computeAttackBonus(G, ctx, spec)
  const defense = readDefense(G, ctx.defenderId, spec.vs)
  const data = {
    attackerId: ctx.attackerId,
    defenderId: ctx.defenderId,
    vs: spec.vs,
    defense,
    bonusParts: bonus.parts,
    bonusTotal: bonus.total
  }
  return [{ type: 'log', value: { type: 'attack-preview', msg: `Attack preview`, data } }]
}

// D6: Damage evaluation (supports d6 dice + flat + abilityMod); crit maximizes dice
export const evaluateDamage = (G, ctx, damageSpec = {}, options = {}) => {
  const parts = []
  let diceTotal = 0
  let patches = []
  const dice = damageSpec.dice || [] // [{ n:2, d:6 }]
  const crit = !!options.crit
  if (dice.length > 0) {
    const onlyD6 = dice.every(d => d.d === 6)
    if (crit) {
      for (const { n, d } of dice) {
        const max = n * d
        parts.push({ label: `${n}d${d} (max)`, value: max })
        diceTotal += max
      }
    } else if (onlyD6) {
      const terms = []
      for (const { n } of dice) {
        for (let i = 0; i < n; i++) terms.push('d6')
      }
      const r = roll(G, { kind: 'sum', terms })
      patches = r.patches
      diceTotal = r.result
      parts.push({ label: `dice`, value: diceTotal })
    } else {
      // Unsupported die; treat as average fallback
      for (const { n, d } of dice) {
        const avg = Math.floor(n * (d + 1) / 2)
        parts.push({ label: `${n}d${d} (avg)`, value: avg })
        diceTotal += avg
      }
    }
  }
  let staticTotal = 0
  if (damageSpec.flat) { parts.push({ label: 'flat', value: damageSpec.flat }); staticTotal += damageSpec.flat }
  if (damageSpec.ability) {
    const attacker = (G.actors && G.actors[ctx.attackerId]) || {}
    const abilityMods = attacker.abilityMods || { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
    const mod = abilityMods[damageSpec.ability] || 0
    parts.push({ label: `${damageSpec.ability}`, value: mod })
    staticTotal += mod
  }
  let total = diceTotal + staticTotal
  if (options.weakened) total = Math.floor(total / 2)
  if (options.onMiss && damageSpec.halfOnMiss) {
    total = Math.floor(total / 2)
  }
  const log = { type: 'damage-roll', msg: `Damage roll`, data: { attackerId: ctx.attackerId, defenderId: ctx.defenderId, crit, parts, total } }
  return { rolled: diceTotal, static: staticTotal, total, parts, patches: [...patches, { type: 'log', value: log }] }
}

// D7: Damage application with temp/resist/vuln/immune, min 0; updates bloodied
export const applyDamage = (G, defenderId, amount, type) => {
  const defender = (G.actors && G.actors[defenderId]) || {}
  const hp = defender.hp || { current: 1, max: 1, temp: 0 }
  const before = { hp: hp.current ?? 0, temp: hp.temp ?? 0 }
  let adjusted = amount
  const immune = defender.immune && type && defender.immune[type]
  const resistVal = (defender.resist && type && defender.resist[type]) || 0
  const vulnVal = (defender.vulnerable && type && defender.vulnerable[type]) || 0
  if (immune) adjusted = 0
  adjusted = Math.max(0, adjusted + vulnVal - resistVal)
  let consumedTemp = 0
  let afterTemp = hp.temp || 0
  let remaining = adjusted
  if (afterTemp > 0 && remaining > 0) {
    consumedTemp = Math.min(afterTemp, remaining)
    afterTemp -= consumedTemp
    remaining -= consumedTemp
  }
  let afterHp = Math.max(0, (hp.current || 0) - remaining)
  const patches = []
  patches.push({ type: 'set', path: `actors.${defenderId}.hp.temp`, value: afterTemp })
  patches.push({ type: 'set', path: `actors.${defenderId}.hp.current`, value: afterHp })
  // bloodied flag
  const max = hp.max || 1
  const bloodied = afterHp <= Math.floor(max / 2)
  patches.push({ type: 'merge', path: `actors.${defenderId}`, value: { bloodied } })
  patches.push({ type: 'log', value: { type: 'damage-apply', msg: `Damage applied to ${defenderId}`, data: { before, after: { hp: afterHp, temp: afterTemp }, resist: resistVal, vuln: vulnVal, immune: !!immune, final: remaining } } })
  return { final: remaining, consumedTemp, resisted: resistVal, vulnerable: vulnVal, patches }
}


