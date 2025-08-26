import { test, expect } from "bun:test"
import { initialState, applyPatches, applyHealing, spendSurge, secondWind, gainTempHP, deathSave, stabilize, advanceTurn, setInitiativeOrder } from '../src/rules/index.js'

test('G2/G3: Second Wind heals surge value, once per encounter, +2 defenses flag', () => {
  const G = initialState(42)
  G.actors = { A1: { hp: { current: 5, max: 20, temp: 0 }, surges: { remaining: 2, value: 5 }, flags: {} } }
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  let patches = secondWind(G, 'A1')
  applyPatches(G, patches)
  expect(G.actors.A1.hp.current).toBe(10)
  expect(G.actors.A1.surges.remaining).toBe(1)
  expect(G.actors.A1.flags.defenseBonus).toBe(2)
  // Second use should be denied
  patches = secondWind(G, 'A1')
  applyPatches(G, patches)
  expect(G.actors.A1.surges.remaining).toBe(1)
})

test('G3: applyHealing raises from negative to 0, clears dying', () => {
  const G = initialState(42)
  G.actors = { A1: { hp: { current: -3, max: 20, temp: 0 }, death: { failures: 1, stabilized: false }, flags: { dying: true } } }
  const { patches } = applyHealing(G, 'A1', 5, { requiresSurge: false, allowOverflow: false })
  applyPatches(G, patches)
  expect(G.actors.A1.hp.current).toBe(5)
  expect(G.actors.A1.death.failures).toBe(0)
  expect(G.actors.A1.death.stabilized).toBe(false)
  expect(G.actors.A1.flags.dying).toBe(false)
})

test('G4: gainTempHP overwrites to max', () => {
  const G = initialState(42)
  G.actors = { A1: { hp: { current: 10, max: 20, temp: 3 } } }
  applyPatches(G, gainTempHP(G, 'A1', 5))
  expect(G.actors.A1.hp.temp).toBe(5)
  applyPatches(G, gainTempHP(G, 'A1', 2))
  expect(G.actors.A1.hp.temp).toBe(5)
})

test('G6/G7: drop to 0 triggers dying; death save fail increments; 3 failures -> dead; nat 20 surge if available', () => {
  const G = initialState(42)
  G.actors = { A1: { hp: { current: 3, max: 20, temp: 0 }, surges: { remaining: 1, value: 5 }, death: { failures: 0, stabilized: false }, flags: {} } }
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  // Apply lethal damage
  const { applyDamage } = require('../src/rules/attacks.js')
  let res = applyDamage(G, 'A1', 10, 'untyped')
  applyPatches(G, res.patches)
  expect(G.actors.A1.flags.dying).toBe(true)
  // End of turn: force failure
  let patches = advanceTurn(G)
  applyPatches(G, patches)
  // Because death save is random, force one explicitly
  let ds = deathSave(G, 'A1', { forceD20: 5 })
  applyPatches(G, ds.patches)
  expect(G.actors.A1.death.failures).toBeGreaterThanOrEqual(1)
  // Two more forced fails -> dead
  ds = deathSave(G, 'A1', { forceD20: 5 })
  applyPatches(G, ds.patches)
  ds = deathSave(G, 'A1', { forceD20: 5 })
  applyPatches(G, ds.patches)
  expect(G.actors.A1.flags.dead).toBe(true)
})

test('G8: stabilize sets stabilized and damage breaks it', () => {
  const G = initialState(42)
  G.actors = { A1: { hp: { current: 0, max: 20, temp: 0 }, death: { failures: 0, stabilized: false }, flags: { dying: true } }, H: { } }
  const { success, patches } = stabilize(G, 'A1', 'H', { dc: 10, forceD20: 15 })
  applyPatches(G, patches)
  expect(success).toBe(true)
  expect(G.actors.A1.death.stabilized).toBe(true)
  // Taking damage removes stabilized and resumes dying
  const { applyDamage } = require('../src/rules/attacks.js')
  const res = applyDamage(G, 'A1', 3, 'untyped')
  applyPatches(G, res.patches)
  expect(G.actors.A1.death.stabilized).toBe(false)
  expect(G.actors.A1.flags.dying).toBe(true)
})


