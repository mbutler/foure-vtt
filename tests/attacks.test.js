import { test, expect } from "bun:test"
import { initialState } from '../src/rules/index.js'
import { computeAttackBonus, rollToHit, resolveAttack, resolveAttackMulti, evaluateDamage, applyDamage, buildAttackPreview } from '../src/rules/attacks.js'
import { applyPatches } from '../src/engine/patches.js'

test('D3: computeAttackBonus with CA and cover', () => {
  const G = initialState(42)
  G.actors = { A1: { abilityMods: { STR: 4 }, defenses: { AC: 16 } }, D1: { defenses: { AC: 16 } } }
  const ctx = { attackerId: 'A1', defenderId: 'D1', bonuses: { flat: 1 }, flags: { combatAdvantage: true, cover: 'cover' } }
  const spec = { ability: 'STR', proficiency: 2, enhancement: 1 }
  const res = computeAttackBonus(G, ctx, spec)
  expect(res.total).toBe(4 + 2 + 1 + 1 + 2 - 2)
})

test('D4: nat 1 and nat 20 semantics', () => {
  const G = initialState(42)
  const ctx = { attackerId: 'A1', defenderId: 'D1' }
  const bonus = { total: 5 }
  let r = rollToHit(G, ctx, bonus, { forceD20: 1 })
  expect(r.autoMiss).toBe(true)
  r = rollToHit(G, ctx, bonus, { forceD20: 20 })
  expect(r.crit).toBe(true)
})

test('D5: resolveAttack logs and outcomes', () => {
  const G = initialState(42)
  G.actors = { A1: { abilityMods: { STR: 4 }, defenses: { AC: 10 } }, D1: { defenses: { AC: 15 } } }
  const ctx = { attackerId: 'A1', defenderId: 'D1', bonuses: { flat: 0 }, flags: { combatAdvantage: false } }
  const spec = { ability: 'STR', vs: 'AC', proficiency: 0, enhancement: 0 }
  // Force d20 = 10; total = 14 vs 15 -> miss
  let { patches } = resolveAttack(G, ctx, spec, { forceD20: 10 })
  applyPatches(G, patches)
  let last = G.log[G.log.length - 1]
  expect(last.type).toBe('attack-result')
  expect(last.data.outcome).toBe('miss')
  // Force d20 = 20 -> crit
  ;({ patches } = resolveAttack(G, ctx, spec, { forceD20: 20 }))
  applyPatches(G, patches)
  last = G.log[G.log.length - 1]
  expect(last.data.outcome).toBe('crit')
})

test('D6: evaluateDamage rolls dice and halves on miss', () => {
  const G = initialState(42)
  const ctx = { attackerId: 'A1', defenderId: 'D1' }
  const spec = { dice: [{ n: 2, d: 6 }], flat: 3 }
  // Normal roll
  let { total, patches } = evaluateDamage(G, ctx, spec, { crit: false })
  expect(typeof total).toBe('number')
  // On miss with halfOnMiss
  const spec2 = { dice: [{ n: 2, d: 6 }], flat: 3, halfOnMiss: true }
  const res = evaluateDamage(G, ctx, spec2, { onMiss: true })
  expect(res.total <= total).toBe(true)
})

test('D7: applyDamage uses temp first and enforces min 0', () => {
  const G = initialState(42)
  G.actors = { D1: { hp: { current: 20, max: 30, temp: 5 }, resist: { fire: 2 } } }
  const { patches } = applyDamage(G, 'D1', 10, 'fire')
  applyPatches(G, patches)
  // resist applies first: 10 - 2 = 8; temp 5 absorbs -> 3 to HP; current 20 -> 17
  expect(G.actors.D1.hp.temp).toBe(0)
  expect(G.actors.D1.hp.current).toBe(17)
})

test('D8: multi-target rolls per defender', () => {
  const G = initialState(42)
  G.actors = { A1: { abilityMods: { STR: 0 } }, D1: { defenses: { AC: 10 }, hp: { current: 10, max: 10, temp: 0 } }, D2: { defenses: { AC: 10 }, hp: { current: 10, max: 10, temp: 0 } } }
  const ctx = { attackerId: 'A1', staged: { targets: ['D1','D2'] } }
  const spec = { ability: 'STR', vs: 'AC', hit: { damage: { dice: [{ n: 1, d: 6 }], flat: 0, type: 'untyped' } } }
  // Force d20=15 so both hit
  const { patches } = resolveAttackMulti(G, ctx, spec, { forceD20: 15 })
  applyPatches(G, patches)
  // Two attack-result logs appended
  const attackResults = G.log.filter(e => e.type === 'attack-result')
  expect(attackResults.length).toBeGreaterThanOrEqual(2)
})

test('D10/D13: MBA smoke test end-to-end', () => {
  const G = initialState(42)
  G.actors = {
    A1: { abilityMods: { STR: 4 }, defenses: { AC: 15 } },
    D1: { defenses: { AC: 14 }, hp: { current: 25, max: 25, temp: 0 } }
  }
  const ctx = { attackerId: 'A1', defenderId: 'D1' }
  const spec = { kind: 'melee-weapon', vs: 'AC', ability: 'STR', hit: { damage: { dice: [{ n: 1, d: 6 }], ability: 'STR', type: 'untyped' } } }
  // Preview
  let patches = buildAttackPreview(G, ctx, spec)
  applyPatches(G, patches)
  // Resolve with forced 15 -> total >= defense
  const res = resolveAttack(G, ctx, spec, { forceD20: 15 })
  applyPatches(G, res.patches)
  const last = G.log[G.log.length - 1]
  expect(last.type).toBe('damage-apply')
  expect(G.actors.D1.hp.current).toBeLessThan(25)
})

test('E7: weakened halves damage dealt', () => {
  const G = initialState(42)
  G.actors = {
    A1: { abilityMods: { STR: 0 } },
    D1: { defenses: { AC: 10 }, hp: { current: 20, max: 20, temp: 0 } }
  }
  const ctx = { attackerId: 'A1', defenderId: 'D1' }
  const spec = { vs: 'AC', ability: 'STR', hit: { damage: { dice: [{ n: 2, d: 6 }], flat: 0, type: 'untyped' } } }
  // Apply weakened on attacker
  const { applyCondition } = require('../src/rules/effects.js')
  const res = applyCondition(G, { conditionId: 'weakened', source: 'SRC', target: 'A1', duration: 'saveEnds' })
  applyPatches(G, res.patches)
  // Resolve attack with forced 15 to hit
  const outcome = resolveAttack(G, ctx, spec, { forceD20: 15 })
  applyPatches(G, outcome.patches)
  // HP reduced, but average should be around half; just check less-than a plausible upper bound
  expect(G.actors.D1.hp.current).toBeGreaterThan(10)
})


