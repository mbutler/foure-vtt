import { test, expect } from "bun:test"
import { initialState, advanceTurn, spendAction, roll } from '../src/rules/index.js'
import { applyPatches } from '../src/engine/patches.js'

test("A1: Initial state is serializable", () => {
  const G = initialState(42)
  const serialized = JSON.stringify(G)
  const deserialized = JSON.parse(serialized)
  
  expect(deserialized.rng.seed).toBe(42)
  expect(deserialized.rng.cursor).toBe(0)
  expect(deserialized.round).toBe(1)
  expect(deserialized.turn.index).toBe(0)
  expect(deserialized.actions.standard).toBe(1)
})

test("A2: Deterministic RNG", () => {
  const G1 = initialState(42)
  const G2 = initialState(42)
  
  const { result: result1 } = roll(G1, 'd20')
  const { result: result2 } = roll(G2, 'd20')
  
  expect(result1).toBe(result2)
  expect(G1.rng.cursor).toBe(G2.rng.cursor)
})

test("A3: Turn advancement", () => {
  const G = initialState(42)
  
  // Set up initiative
  applyPatches(G, [
    { type: 'set', path: 'turn.order', value: ['A1', 'A2', 'A3'] }
  ])
  
  // Advance turn
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  
  expect(G.turn.index).toBe(1)
  expect(G.turn.order[G.turn.index]).toBe('A2')
})

test("A8: Action spending", () => {
  const G = initialState(42)
  
  const patches = spendAction(G, 'standard')
  applyPatches(G, patches)
  
  expect(G.actions.standard).toBe(0)
  expect(G.actions.move).toBe(1)
  expect(G.actions.minor).toBe(1)
})
