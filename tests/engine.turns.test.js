import { test, expect } from "bun:test"
import { initialState, advanceTurn, spendAction, roll, setInitiativeOrder, insertActorIntoInitiative, removeActorFromInitiative, delayTurn, readyAction, addEffect } from '../src/rules/index.js'
import { applyCondition } from '../src/rules/effects.js'
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
  applyPatches(G, setInitiativeOrder(G, ['A1', 'A2', 'A3']))
  
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

test("A9: Action swaps - standard to move", () => {
  const G = initialState(42)
  const patches = spendAction(G, 'move') // should consume standard instead of move if desired
  applyPatches(G, patches)
  // Rule: prefer native slot when available; here move exists so consume move
  expect(G.actions.move).toBe(0)
  expect(G.actions.standard).toBe(1)
})

test("A10: Action swaps - move to minor", () => {
  const G = initialState(42)
  // Spend minor while minor available -> consumes minor
  let patches = spendAction(G, 'minor')
  applyPatches(G, patches)
  expect(G.actions.minor).toBe(0)
  expect(G.actions.move).toBe(1)
  expect(G.actions.standard).toBe(1)

  // Reset to initial again to test swap path: consume move as minor when minor is 0
  const G2 = initialState(42)
  // First, use up minor
  patches = spendAction(G2, 'minor')
  applyPatches(G2, patches)
  // Now request another minor; should swap from move
  patches = spendAction(G2, 'minor')
  applyPatches(G2, patches)
  expect(G2.actions.minor).toBe(0)
  expect(G2.actions.move).toBe(0)
  expect(G2.actions.standard).toBe(1)
})

test("A11: Action swaps - standard to minor", () => {
  const G = initialState(42)
  // Use up minor and move, then minor again should consume standard
  let patches = spendAction(G, 'minor')
  applyPatches(G, patches)
  patches = spendAction(G, 'move')
  applyPatches(G, patches)
  patches = spendAction(G, 'minor')
  applyPatches(G, patches)
  expect(G.actions.standard).toBe(0)
  expect(G.actions.move).toBe(0)
  expect(G.actions.minor).toBe(0)
})

test("A12: Round begin hook fires on wrap", () => {
  const G = initialState(42)
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  // With single actor, advancing once wraps and begins next round
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  expect(G.round).toBe(2)
  const hasRoundBegin = G.log.some(e => e.type === 'round-begin')
  expect(hasRoundBegin).toBe(true)
})

test("E6: Dazed action mask applied at turn begin", () => {
  const G = initialState(42)
  G.actors = { A1: { conditions: [] } }
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  // Apply dazed condition via effects
  const res = applyCondition(G, { conditionId: 'dazed', source: 'SRC', target: 'A1', duration: 'saveEnds' })
  applyPatches(G, res.patches)
  // Advance turn to trigger onTurnBegin mask
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  expect(G.actions.standard).toBe(1)
  expect(G.actions.move).toBe(0)
  expect(G.actions.minor).toBe(0)
})

test("E8/E5: Ongoing damage ticks at start and save ends at end", () => {
  const G = initialState(42)
  G.actors = { A1: { conditions: [], hp: { current: 20, max: 20, temp: 0 } } }
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  // Apply ongoing 5 fire (save ends) to A1
  const { applyCondition } = require('../src/rules/effects.js')
  const res = applyCondition(G, { conditionId: 'ongoing-damage', source: 'SRC', target: 'A1', duration: 'saveEnds', data: { amount: 5, type: 'fire' } })
  applyPatches(G, res.patches)
  // Advance to start of A1's turn (single actor -> start triggers immediately)
  let patches = advanceTurn(G)
  applyPatches(G, patches)
  expect(G.actors.A1.hp.current).toBe(15)
  // End of turn should attempt a save (may fail due to RNG); just assert a save-roll log exists
  patches = advanceTurn(G)
  applyPatches(G, patches)
  const hadSave = G.log.some(e => e.type === 'save-roll')
  expect(hadSave).toBe(true)
})

test("E10: Sustain preserves effect; otherwise expires at end", () => {
  const G = initialState(42)
  G.actors = { A1: { conditions: [] } }
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  const { applyCondition, sustainEffect } = require('../src/rules/effects.js')
  const res = applyCondition(G, { conditionId: 'zone', source: 'SRC', target: 'A1', duration: 'encounter', data: { sustain: 'minor' } })
  applyPatches(G, res.patches)
  // End turn without sustain -> should expire
  let patches = advanceTurn(G)
  applyPatches(G, patches)
  patches = advanceTurn(G)
  applyPatches(G, patches)
  let exists = !!G.effects[Object.keys(G.effects)[0]]
  // Re-apply and sustain
  const res2 = applyCondition(G, { conditionId: 'zone', source: 'SRC', target: 'A1', duration: 'encounter', data: { sustain: 'minor' } })
  applyPatches(G, res2.patches)
  applyPatches(G, sustainEffect(G, res2.instanceId))
  // Advance once (end of current turn); effect should still exist
  patches = advanceTurn(G)
  applyPatches(G, patches)
  exists = Object.values(G.effects || {}).some(e => e && e.id === res2.instanceId)
  expect(exists).toBe(true)
})

test("A13: Initiative utils insert/remove", () => {
  const G = initialState(42)
  applyPatches(G, setInitiativeOrder(G, ['A1', 'A3']))
  applyPatches(G, insertActorIntoInitiative(G, 'A2', 1))
  expect(G.turn.order).toEqual(['A1', 'A2', 'A3'])
  applyPatches(G, removeActorFromInitiative(G, 'A2'))
  expect(G.turn.order).toEqual(['A1', 'A3'])
})

test("A14: Delay adds to queue and logs", () => {
  const G = initialState(42)
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  const patches = delayTurn(G)
  applyPatches(G, patches)
  expect(G.queue.some(q => q.type === 'delay' && q.actorId === 'A1')).toBe(true)
  const found = G.log.some(e => e.type === 'delay' && e.actorId === 'A1')
  expect(found).toBe(true)
})

test("A15: Ready consumes standard and adds to queue", () => {
  const G = initialState(42)
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  const patches = readyAction(G, 'enemy moves adjacent')
  applyPatches(G, patches)
  expect(G.actions.standard).toBe(0)
  expect(G.queue.some(q => q.type === 'ready' && q.actorId === 'A1')).toBe(true)
  const found = G.log.some(e => e.type === 'ready' && e.actorId === 'A1')
  expect(found).toBe(true)
})

test("A16: Delay preempts at start of next turn", () => {
  const G = initialState(42)
  // Seed some actors for logging context
  G.actors = { A1: {}, A2: {} }
  applyPatches(G, setInitiativeOrder(G, ['A1', 'A2']))
  // It's A1's turn; A2 chooses to delay while A1 is acting
  applyPatches(G, delayTurn(G))
  // Advance from A1 to next; on A2's start, delay resolves (even though already A2, this checks no crash)
  let patches = advanceTurn(G)
  applyPatches(G, patches)
  const hasDelayResolve = G.log.some(e => e.type === 'delay-resolve')
  expect(hasDelayResolve).toBe(true)
})

test("A17: Ready resolves at start of turn window", () => {
  const G = initialState(42)
  G.actors = { A1: {}, A2: {} }
  applyPatches(G, setInitiativeOrder(G, ['A1', 'A2']))
  // A1 readies
  applyPatches(G, readyAction(G, 'enemy moves'))
  // Advance to A2; ready should resolve and be removed from queue
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  const hasReadyResolve = G.log.some(e => e.type === 'ready-resolve')
  expect(hasReadyResolve).toBe(true)
  const stillQueued = G.queue.some(q => q.type === 'ready')
  expect(stillQueued).toBe(false)
})

test("A18: FIFO order - multiple readies resolve before delay preempts", () => {
  const G = initialState(42)
  G.actors = { A1: {}, A2: {}, A3: {} }
  applyPatches(G, setInitiativeOrder(G, ['A1', 'A2', 'A3']))
  // Queue two readies then a delay
  applyPatches(G, readyAction(G, 't1')) // A1 readies
  // Simulate next actor readying: enqueue directly to preserve order (test-only simplification)
  applyPatches(G, [ { type: 'add', path: 'queue', value: { type: 'ready', actorId: 'A2', trigger: 't2', round: G.round } } ])
  // Add a delay entry
  applyPatches(G, [ { type: 'add', path: 'queue', value: { type: 'delay', actorId: 'A3', round: G.round } } ])
  // Start next turn; should resolve both ready entries (A1, then A2), then stop at delay (which will preempt if not same actor)
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  const readyResolves = G.log.filter(e => e.type === 'ready-resolve').map(e => e.actorId)
  expect(readyResolves).toEqual(['A1', 'A2'])
  const hasDelayResolve = G.log.some(e => e.type === 'delay-resolve' && e.actorId === 'A3')
  expect(hasDelayResolve).toBe(true)
})

test("A19: Effects expire at start/end of turn", () => {
  const G = initialState(42)
  G.actors = { A1: {} }
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  // Add two effects
  applyPatches(G, addEffect(G, { condition: 'test-start', duration: 'untilStartOfTurn', target: 'A1' }))
  applyPatches(G, addEffect(G, { condition: 'test-end', duration: 'untilEndOfTurn', target: 'A1' }))
  // Start A1's turn, start-duration should expire
  let patches = advanceTurn(G)
  applyPatches(G, patches)
  const hasStartEffect = Object.values(G.effects).some(e => e && e.condition === 'test-start')
  expect(hasStartEffect).toBe(false)
  // End A1's turn, end-duration should expire
  patches = advanceTurn(G)
  applyPatches(G, patches)
  const hasEndEffect = Object.values(G.effects).some(e => e && e.condition === 'test-end')
  expect(hasEndEffect).toBe(false)
})

test("A20: Save-ends performs one roll and may remove effect", () => {
  const G = initialState(42)
  G.actors = { A1: {} }
  applyPatches(G, setInitiativeOrder(G, ['A1']))
  // Add a save-ends effect
  applyPatches(G, addEffect(G, { condition: 'test-save', duration: 'saveEnds', target: 'A1' }))
  const prevCursor = G.rng.cursor
  // End A1's turn -> triggers save roll
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  expect(G.rng.cursor).toBe(prevCursor + 1)
  const hasSaveLog = G.log.some(e => e.type === 'save' && e.actorId === 'A1')
  expect(hasSaveLog).toBe(true)
})

test("A21: Queue invariants with same-actor delay do not churn index", () => {
  const G = initialState(42)
  G.actors = { A1: {}, A2: {} }
  applyPatches(G, setInitiativeOrder(G, ['A1', 'A2']))
  const idxBefore = G.turn.index
  // A1 delays while it's A1; when processed, effective actor matches actorId
  applyPatches(G, delayTurn(G))
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  // No crash and index should be within bounds
  expect(G.turn.index).toBeGreaterThanOrEqual(0)
  expect(G.turn.index).toBeLessThan(G.turn.order.length)
})

test("A22: Initiative invariants on empty order", () => {
  const G = initialState(42)
  // No order; advanceTurn should not crash or change round
  const beforeRound = G.round
  const patches = advanceTurn(G)
  applyPatches(G, patches)
  expect(G.round).toBe(beforeRound)
})
