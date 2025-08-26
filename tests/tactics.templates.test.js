import { test, expect } from "bun:test"
import { chebyshev, neighbors4, neighbors8, toId, fromId, inBounds, actorAt, isOccupied } from '../src/tactics/grid.js'
import { initialState, move, previewMove, commitMove, forced, buildMovePreviewLog, buildTargetPreviewLog, stageTargetingSelection } from '../src/rules/index.js'
import { detectOAFromMovement } from '../src/tactics/grid.js'
import { cellsForSingle, cellsForBurst, cellsForTemplate, cellsForBlast, facingFromVector, areaBurstCentersWithin } from '../src/tactics/templates.js'
import { applyPatches } from '../src/engine/patches.js'
import { hasLoE } from '../src/tactics/los.js'
import { previewTargeting, validateTargeting } from '../src/tactics/targeting.js'
import { normalizeTemplateSpec, validateTemplateSpec, normalizeTargetingSpec, validateTargetingSpec } from '../src/tactics/specs.js'
import { findPath } from '../src/tactics/pathing.js'

test("T1: Template math placeholder", () => {
  expect(true).toBe(true)
})

test("C3: cellsForSingle returns anchor", () => {
  const s = cellsForSingle({ x: 2, y: 3 })
  expect(s.has('2,3')).toBe(true)
  expect(s.size).toBe(1)
})

test("C3: cellsForBurst radius and clipping", () => {
  const board = { w: 5, h: 5 }
  const b1 = cellsForBurst({ x: 2, y: 2 }, 1, board)
  expect(b1.size).toBe(9)
  const b2 = cellsForBurst({ x: 0, y: 0 }, 2, board)
  // clipped to board; top-left corner burst 2 gives 9 cells (0..2 x 0..2)
  expect(b2.size).toBe(9)
})

test("C3: cellsForTemplate single/burst", () => {
  const board = { w: 5, h: 5 }
  const single = cellsForTemplate({ kind: 'single', origin: 'melee' }, { x: 1, y: 1 }, board)
  expect(single.has('1,1')).toBe(true)
  const burst = cellsForTemplate({ kind: 'burst', radius: 1, origin: 'close' }, { x: 1, y: 1 }, board)
  expect(burst.has('1,1')).toBe(true)
  expect(burst.size).toBe(9)
})

test("C4: facingFromVector and blast footprints", () => {
  const board = { w: 10, h: 10 }
  const origin = { x: 5, y: 5 }
  const east = facingFromVector(1, 0)
  const blast3E = cellsForBlast(origin, east, 3, board)
  // Expect three columns east of origin, 3-wide
  expect(blast3E.size).toBe(9)
  expect(Array.from(blast3E).some(id => id === '6,5')).toBe(true)
  const north = facingFromVector(0, -1)
  const blast3N = cellsForBlast(origin, north, 3, board)
  expect(blast3N.size).toBe(9)
  expect(Array.from(blast3N).some(id => id === '5,4')).toBe(true)
})

test("C2/C3/C4: Blast requires facing and integrates with cellsForTemplate", () => {
  const board = { w: 10, h: 10 }
  const origin = { x: 5, y: 5 }
  const east = facingFromVector(1, 0)
  const cells = cellsForTemplate({ kind: 'blast', size: 3 }, origin, board, { facing: east })
  expect(cells.size).toBe(9)
})

test("C2: Melee/Close require LoE to targets", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 1, y: 2 }, E1: { x: 3, y: 2 } }
  // Block LoE
  G.board.blockers = [ '2,0','2,1','2,2','2,3','2,4' ]
  const spec = { kind: 'single', origin: 'melee', reach: 3 }
  const pv = previewTargeting(G, 'A1', spec, {})
  // No candidates because LoE blocked
  expect(pv.errors).toContain('NO_CANDIDATES')
})

test("C3/C2: area burst centers within range and burst cells", () => {
  const board = { w: 5, h: 5 }
  const attacker = { x: 2, y: 2 }
  const centers = areaBurstCentersWithin(attacker, 1, board)
  expect(centers.has('2,2')).toBe(true)
  expect(centers.has('3,2')).toBe(true)
  const spec = { kind: 'burst', origin: 'area', radius: 1, center: { x: 3, y: 2 } }
  const cells = cellsForTemplate(spec, attacker, board)
  expect(cells.has('3,2')).toBe(true)
  expect(cells.size).toBe(9)
})

test("C5: LoE blocked by wall, allowed through doorway", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  // Vertical wall at x=2 blocks straight LoE from (1,2) to (3,2)
  G.board.blockers = [ '2,0','2,1','2,2','2,3','2,4' ]
  expect(hasLoE(G, { x:1,y:2 }, { x:3,y:2 })).toBe(false)
  // Create a doorway at (2,2)
  G.board.blockers = [ '2,0','2,1','2,3','2,4' ]
  expect(hasLoE(G, { x:1,y:2 }, { x:3,y:2 })).toBe(true)
})

test("C7/C9/C10: Target filters and error codes", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 1, y: 1 }, E1: { x: 2, y: 1 }, E2: { x: 3, y: 1 } }
  G.actors = { A1: { team: 'A' }, E1: { team: 'B' }, E2: { team: 'B' } }
  // Ranged single enemies only, range 2
  const spec = { kind: 'single', origin: 'ranged', range: 2, targeting: { who: 'enemies', maxTargets: 2 } }
  const pv = previewTargeting(G, 'A1', spec, {})
  expect(pv.errors.length).toBe(0)
  // Should include E1, E2 if within range; E2 at x=3 from x=1 is range 2 -> included
  expect(pv.targets.length).toBeGreaterThan(0)
})

test("C11/C12: Target preview log and staging patches", () => {
  const { applyPatches } = require('../src/engine/patches.js')
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 1, y: 1 }, E1: { x: 2, y: 1 } }
  G.actors = { A1: { team: 'A' }, E1: { team: 'B' } }
  const spec = { kind: 'single', origin: 'ranged', range: 5, targeting: { who: 'enemies', maxTargets: 1 } }
  const pv = previewTargeting(G, 'A1', spec, {})
  applyPatches(G, buildTargetPreviewLog('A1', spec, pv, {}))
  let last = G.log[G.log.length - 1]
  expect(last.type).toBe('target-preview')
  const patches = stageTargetingSelection(G, 'A1', spec, {}, pv.targets)
  applyPatches(G, patches)
  expect(G.staging && G.staging.targeting && Array.isArray(G.staging.targeting.targets)).toBe(true)
})

test("C9: Area burst center required and range errors", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 0, y: 0 } }
  let spec = { kind: 'burst', origin: 'area', radius: 1, range: 2, requiresLoEToOrigin: true }
  let pv = previewTargeting(G, 'A1', spec, {})
  expect(pv.errors).toContain('CENTER_REQUIRED')
  pv = previewTargeting(G, 'A1', spec, { center: { x: 4, y: 4 } })
  expect(pv.errors).toContain('OUT_OF_RANGE')
})

test("C1: Spec normalize/validate", () => {
  const t = normalizeTemplateSpec({ kind: 'burst', origin: 'area', radius: '2', range: '10' })
  expect(t.radius).toBe(2)
  expect(t.range).toBe(10)
  const v = validateTemplateSpec(t)
  expect(v.ok).toBe(true)
  const tg = normalizeTargetingSpec({ who: 'enemies', minTargets: 1, maxTargets: 2 })
  const vg = validateTargetingSpec(tg)
  expect(vg.ok).toBe(true)
})

test("B1: cell id round-trip and bounds", () => {
  const c = { x: 3, y: 5 }
  const id = toId(c)
  expect(id).toBe('3,5')
  expect(fromId(id)).toEqual(c)
  expect(inBounds(c, { w: 10, h: 10 })).toBe(true)
  expect(inBounds({ x: -1, y: 0 }, { w: 10, h: 10 })).toBe(false)
  expect(inBounds({ x: 9, y: 9 }, { w: 10, h: 10 })).toBe(true)
  expect(inBounds({ x: 10, y: 9 }, { w: 10, h: 10 })).toBe(false)
})

test("B2: chebyshev and neighbors", () => {
  expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4)
  expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3)
  const n4 = neighbors4({ x: 0, y: 0 })
  expect(n4).toEqual([
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
  ])
  const n8 = neighbors8({ x: 0, y: 0 })
  expect(n8).toContainEqual({ x: 1, y: 1 })
  expect(n8.length).toBe(8)
})

test("B1: occupancy helpers", () => {
  const G = initialState(42)
  G.board.positions = { A1: { x: 1, y: 1 }, A2: { x: 2, y: 2 } }
  expect(isOccupied(G, { x: 1, y: 1 })).toBe(true)
  expect(isOccupied(G, { x: 0, y: 0 })).toBe(false)
  expect(actorAt(G, { x: 2, y: 2 })).toBe('A2')
  expect(actorAt(G, { x: 3, y: 3 })).toBe(null)
})

test("B4: cannot path through blockers", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.blockers = [ '1,0', '1,1', '1,2', '1,3', '1,4' ]
  const res = findPath(G, { x: 0, y: 2 }, { x: 4, y: 2 })
  expect(res).toBe(null)
})

test("B4: ally pass-through allowed, cannot end on ally", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A2: { x: 2, y: 2 } }
  // path across ally at 2,2 to reach 4,2
  const res = findPath(G, { x: 0, y: 2 }, { x: 4, y: 2 })
  expect(res).not.toBe(null)
  // but cannot end on ally
  const res2 = findPath(G, { x: 0, y: 2 }, { x: 2, y: 2 })
  expect(res2).toBe(null)
})

test("B3: enemy-occupied is impassable; ally pass-through allowed; narrow blocked by enemy", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  // Place mover, ally, and enemy
  G.board.positions = { A1: { x: 0, y: 0 }, AL: { x: 1, y: 0 }, EN: { x: 2, y: 0 } }
  G.actors = { A1: { team: 'A' }, AL: { team: 'A' }, EN: { team: 'B' } }
  // Ally at 1,0 should allow pass-through to 3,0
  let res = findPath(G, { x: 0, y: 0 }, { x: 3, y: 0 }, { moverId: 'A1' })
  expect(res).not.toBe(null)
  // Path should not pass through enemy cell 2,0
  const containsEnemy = res.path.some(p => p.x === 2 && p.y === 0)
  expect(containsEnemy).toBe(false)
  // Block bypass row to force a corridor; now enemy blocks progress
  G.board.blockers = [ '0,1','1,1','2,1','3,1','4,1' ]
  res = findPath(G, { x: 0, y: 0 }, { x: 4, y: 0 }, { moverId: 'A1' })
  expect(res).toBe(null)
})

test("B4: difficult terrain costs double (single step)", () => {
  const G = initialState(42)
  G.board.w = 3; G.board.h = 3
  G.board.difficult = [ '1,0' ]
  const res = findPath(G, { x: 0, y: 0 }, { x: 1, y: 0 })
  expect(res).not.toBe(null)
  expect(res.cost).toBe(2) // entering a difficult cell costs 2
})

test("B5: reachable monotonicity", () => {
  const { reachable } = require('../src/tactics/pathing.js')
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 0, y: 0 } }
  const r1 = reachable(G, 'A1', 2)
  const r2 = reachable(G, 'A1', 3)
  for (const id of r1) expect(r2.has(id)).toBe(true)
})

test("B6: shift exactly 1 and not into difficult", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 0, y: 0 } }
  // valid shift
  let patches = move.shift(G, 'A1', { x: 1, y: 0 })
  const { applyPatches } = require('../src/engine/patches.js')
  applyPatches(G, patches)
  expect(G.board.positions.A1).toEqual({ x: 1, y: 0 })
  // difficult shift blocked
  G.board.difficult = [ '2,0' ]
  patches = move.shift(G, 'A1', { x: 2, y: 0 })
  applyPatches(G, patches)
  expect(G.board.positions.A1).toEqual({ x: 1, y: 0 })
})

test("B6: walk/run/standUp patches", () => {
  const { applyPatches } = require('../src/engine/patches.js')
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 0, y: 0 } }
  let patches = move.walk(G, 'A1', { x: 1, y: 0 })
  applyPatches(G, patches)
  expect(G.board.positions.A1).toEqual({ x: 1, y: 0 })
  // run sets flag
  patches = move.run(G, 'A1', { x: 2, y: 0 })
  applyPatches(G, patches)
  expect(G.flags && G.flags.ranThisTurn).toBe(true)
  // stand up requires prone
  G.actors = { A1: { conditions: ['prone'] } }
  patches = move.standUp(G, 'A1')
  applyPatches(G, patches)
  expect(G.actors.A1.conditions.includes('prone')).toBe(false)
})

test("E7: immobilized blocks walk/shift; slowed caps budget to 2", () => {
  const G = initialState(42)
  G.board.w = 10; G.board.h = 10
  G.board.positions = { A1: { x: 0, y: 0 } }
  G.actors = { A1: { speed: 6 } }
  const { applyCondition } = require('../src/rules/effects.js')
  // immobilized
  let r = applyCondition(G, { conditionId: 'immobilized', source: 'SRC', target: 'A1', duration: 'saveEnds' })
  applyPatches(G, r.patches)
  let pv = previewMove(G, 'A1', { x: 1, y: 0 }, 'walk')
  expect(pv.ok).toBe(false)
  // clear effects quickly
  G.effects = {}
  // slowed caps range to 2
  r = applyCondition(G, { conditionId: 'slowed', source: 'SRC', target: 'A1', duration: 'saveEnds' })
  applyPatches(G, r.patches)
  pv = previewMove(G, 'A1', { x: 3, y: 0 }, 'walk')
  const hasRange = (pv.warns || []).some(w => w.type === 'range' && w.max === 2)
  expect(hasRange).toBe(true)
})

test("E9: mark flag presence via applyMark", () => {
  const G = initialState(42)
  const { applyMark } = require('../src/rules/effects.js')
  const res = applyMark(G, 'A1', 'D1', 'saveEnds')
  applyPatches(G, res.patches)
  const exists = Object.values(G.effects || {}).some(e => e && e.conditionId === 'marked' && e.target === 'D1')
  expect(exists).toBe(true)
})

test("B8: preview vs commit logs are structured", () => {
  const { applyPatches } = require('../src/engine/patches.js')
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 0, y: 0 } }
  const pv = previewMove(G, 'A1', { x: 1, y: 0 }, 'walk')
  applyPatches(G, buildMovePreviewLog('A1', pv, 'walk'))
  let last = G.log[G.log.length - 1]
  expect(last.type).toBe('move-preview')
  expect(last.data.actorId).toBe('A1')
  expect(last.data.from).toEqual({ x: 0, y: 0 })
  const patches = commitMove(G, 'A1', pv)
  applyPatches(G, patches)
  last = G.log[G.log.length - 1]
  expect(last.type).toBe('move-commit')
  expect(last.data.actorId).toBe('A1')
  expect(Array.isArray(last.data.path)).toBe(true)
  expect(last.data.from).toEqual({ x: 0, y: 0 })
})

test("B8: speed budget warns; run grants +2", () => {
  const G = initialState(42)
  G.board.w = 20; G.board.h = 20
  G.board.positions = { A1: { x: 0, y: 0 } }
  G.actors = { A1: { speed: 6 } }
  // 8 steps away
  let pv = previewMove(G, 'A1', { x: 8, y: 0 }, 'walk')
  const hasRangeWarn = (pv.warns || []).some(w => w.type === 'range' && w.max === 6)
  expect(hasRangeWarn).toBe(true)
  // Run should warn only if > 8
  pv = previewMove(G, 'A1', { x: 8, y: 0 }, 'run')
  const hasRangeWarnRun = (pv.warns || []).some(w => w.type === 'range')
  expect(hasRangeWarnRun).toBe(false)
})

test("B8: previewMove does not mutate state", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 0, y: 0 } }
  const logLen = G.log.length
  const pv = previewMove(G, 'A1', { x: 1, y: 0 }, 'walk')
  expect(pv.ok).toBe(true)
  // State unchanged
  expect(G.board.positions.A1).toEqual({ x: 0, y: 0 })
  expect(G.log.length).toBe(logLen)
})

test("B9: OA detection warns when leaving adjacency (non-shift)", () => {
  const G = initialState(42)
  G.board.w = 5; G.board.h = 5
  G.board.positions = { A1: { x: 1, y: 1 }, E1: { x: 1, y: 2 } }
  const pv = previewMove(G, 'A1', { x: 3, y: 1 }, 'walk')
  expect(pv.ok).toBe(true)
  const hasOA = (pv.warns || []).some(w => w.type === 'oa' && w.provokers.includes('E1'))
  expect(hasOA).toBe(true)
  // Shift should not warn
  const pv2 = previewMove(G, 'A1', { x: 2, y: 1 }, 'shift')
  const hasOA2 = (pv2.warns || []).some(w => w.type === 'oa')
  expect(hasOA2).toBe(false)
})

test("B7: push moves away until blocked", () => {
  const { applyPatches } = require('../src/engine/patches.js')
  const G = initialState(42)
  G.board.w = 10; G.board.h = 10
  G.board.positions = { S: { x: 2, y: 2 }, T: { x: 3, y: 2 } }
  // Block at (6,2) so push of 5 stops early
  G.board.blockers = [ '6,2' ]
  const patches = forced.push(G, 'S', 'T', 5)
  applyPatches(G, patches)
  expect(G.board.positions.T.x).toBe(5)
  expect(G.board.positions.T.y).toBe(2)
})

test("B7: pull moves toward until adjacent", () => {
  const { applyPatches } = require('../src/engine/patches.js')
  const G = initialState(42)
  G.board.w = 10; G.board.h = 10
  G.board.positions = { S: { x: 2, y: 2 }, T: { x: 7, y: 2 } }
  const patches = forced.pull(G, 'S', 'T', 5)
  applyPatches(G, patches)
  expect( Math.max(Math.abs(G.board.positions.T.x - 2), Math.abs(G.board.positions.T.y - 2)) ).toBe(1)
})

test("B7: slide follows chooser up to N steps", () => {
  const { applyPatches } = require('../src/engine/patches.js')
  const G = initialState(42)
  G.board.w = 10; G.board.h = 10
  G.board.positions = { T: { x: 0, y: 0 } }
  const chooser = (_cur, neigh) => neigh.find(c => c.x === _cur.x + 1 && c.y === _cur.y) || neigh[0]
  const patches = forced.slide(G, null, 'T', 3, chooser)
  applyPatches(G, patches)
  expect(G.board.positions.T).toEqual({ x: 3, y: 0 })
})
