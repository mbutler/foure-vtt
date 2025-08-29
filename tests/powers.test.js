import { test, expect } from "bun:test"
import { initialState } from '../src/rules/index.js'
import { applyPatches } from '../src/engine/patches.js'
import { createPower, canUsePower, executePower, POWER_TYPES, ACTION_TYPES, EXAMPLE_POWERS } from '../src/rules/powers.js'

test('Power creation and normalization', () => {
  const power = createPower({
    id: 'test-power',
    name: 'Test Power',
    type: POWER_TYPES.ENCOUNTER,
    action: ACTION_TYPES.STANDARD,
    target: 'single',
    range: 5,
    attack: { vs: 'AC', ability: 'STR', proficiency: 2 },
    hit: { damage: { dice: [{ n: 1, d: 8 }], flat: 3, type: 'untyped' } }
  })
  
  expect(power.id).toBe('test-power')
  expect(power.name).toBe('Test Power')
  expect(power.type).toBe(POWER_TYPES.ENCOUNTER)
  expect(power.action).toBe(ACTION_TYPES.STANDARD)
  expect(power.target).toBe('single')
  expect(power.range).toBe(5)
  expect(power.attack.vs).toBe('AC')
  expect(power.attack.ability).toBe('STR')
  expect(power.attack.proficiency).toBe(2)
  expect(power.hit.damage.dice[0].n).toBe(1)
  expect(power.hit.damage.dice[0].d).toBe(8)
  expect(power.hit.damage.flat).toBe(3)
})

test('Power validation - basic checks', () => {
  const G = initialState(42)
  G.actors = { A1: { team: 'A' } }
  G.turn = { order: ['A1'], index: 0 }
  G.actions = { standard: 1, move: 1, minor: 1, free: 'unbounded' }
  
  const power = EXAMPLE_POWERS.basicAttack
  
  // Valid power usage
  let result = canUsePower(G, 'A1', power)
  expect(result.success).toBe(true)
  
  // No standard action available
  G.actions.standard = 0
  result = canUsePower(G, 'A1', power)
  expect(result.success).toBe(false)
  expect(result.reason).toBe('No standard action available')
  
  // Not actor's turn
  G.actions.standard = 1
  G.turn.index = 1
  result = canUsePower(G, 'A1', power)
  expect(result.success).toBe(false)
  expect(result.reason).toBe('Not your turn')
})

test('Power validation - encounter power usage tracking', () => {
  const G = initialState(42)
  G.actors = { A1: { team: 'A' } }
  G.turn = { order: ['A1'], index: 0 }
  G.actions = { standard: 1, move: 1, minor: 1, free: 'unbounded' }
  G.flags = { usage: {} }
  
  const encounterPower = EXAMPLE_POWERS.thunderwave
  
  // First use should succeed
  let result = canUsePower(G, 'A1', encounterPower)
  expect(result.success).toBe(true)
  
  // Mark as used
  G.flags.usage.A1 = { encounterPowers: { 'thunderwave': true } }
  
  // Second use should fail
  result = canUsePower(G, 'A1', encounterPower)
  expect(result.success).toBe(false)
  expect(result.reason).toBe('Encounter power already used')
})

test('Power execution - basic attack', () => {
  const G = initialState(42)
  G.actors = { 
    A1: { team: 'A', abilityMods: { STR: 3 }, defenses: { AC: 15 } },
    E1: { team: 'B', hp: { current: 20, max: 20, temp: 0 } }
  }
  G.turn = { order: ['A1'], index: 0 }
  G.actions = { standard: 1, move: 1, minor: 1, free: 'unbounded' }
  G.board.positions = { A1: { x: 1, y: 1 }, E1: { x: 2, y: 1 } }
  
  const power = EXAMPLE_POWERS.basicAttack
  const targets = ['E1']
  
  // Force a hit for testing
  const { patches } = executePower(G, 'A1', power, targets, { forceD20: 15 })
  applyPatches(G, patches)
  
  // Check that standard action was spent
  expect(G.actions.standard).toBe(0)
  
  // Check that power usage was logged
  const powerLog = G.log.find(e => e.type === 'power-use')
  expect(powerLog).toBeDefined()
  expect(powerLog.data.actorId).toBe('A1')
  expect(powerLog.data.powerId).toBe('basic-attack')
  
  // Check that attack was resolved
  const attackLog = G.log.find(e => e.type === 'attack-result')
  expect(attackLog).toBeDefined()
})

test('Power execution - area attack', () => {
  const G = initialState(42)
  G.actors = { 
    A1: { team: 'A', abilityMods: { CON: 2 }, defenses: { Fort: 12 } },
    E1: { team: 'B', hp: { current: 15, max: 15, temp: 0 } },
    E2: { team: 'B', hp: { current: 15, max: 15, temp: 0 } }
  }
  G.turn = { order: ['A1'], index: 0 }
  G.actions = { standard: 1, move: 1, minor: 1, free: 'unbounded' }
  G.board.positions = { A1: { x: 1, y: 1 }, E1: { x: 2, y: 1 }, E2: { x: 1, y: 2 } }
  
  const power = EXAMPLE_POWERS.thunderwave
  const targets = ['E1', 'E2']
  
  // Force hits for testing
  const { patches } = executePower(G, 'A1', power, targets, { forceD20: 15 })
  applyPatches(G, patches)
  
  // Check that encounter power was marked as used
  expect(G.flags.usage.A1.encounterPowers['thunderwave']).toBe(true)
  
  // Check that both targets were hit
  const attackResults = G.log.filter(e => e.type === 'attack-result')
  expect(attackResults.length).toBeGreaterThanOrEqual(2)
})

test('Power execution - invalid usage', () => {
  const G = initialState(42)
  G.actors = { A1: { team: 'A' } }
  G.turn = { order: ['A1'], index: 0 }
  G.actions = { standard: 0, move: 1, minor: 1, free: 'unbounded' } // No standard action
  
  const power = EXAMPLE_POWERS.basicAttack
  const targets = ['E1']
  
  const { patches } = executePower(G, 'A1', power, targets)
  applyPatches(G, patches)
  
  // Check that error was logged
  const errorLog = G.log.find(e => e.type === 'power-error')
  expect(errorLog).toBeDefined()
  expect(errorLog.msg).toContain('Cannot use Basic Attack')
  
  // Check that no action was spent
  expect(G.actions.standard).toBe(0)
})

test('Example powers are valid', () => {
  // Test that all example powers can be created without errors
  expect(EXAMPLE_POWERS.basicAttack).toBeDefined()
  expect(EXAMPLE_POWERS.magicMissile).toBeDefined()
  expect(EXAMPLE_POWERS.thunderwave).toBeDefined()
  
  // Test that they have required properties
  expect(EXAMPLE_POWERS.basicAttack.id).toBe('basic-attack')
  expect(EXAMPLE_POWERS.magicMissile.id).toBe('magic-missile')
  expect(EXAMPLE_POWERS.thunderwave.id).toBe('thunderwave')
  
  expect(EXAMPLE_POWERS.basicAttack.type).toBe(POWER_TYPES.AT_WILL)
  expect(EXAMPLE_POWERS.thunderwave.type).toBe(POWER_TYPES.ENCOUNTER)
})
