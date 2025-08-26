# 4e Mini‑VTT — MVP **B: Grid & Movement** Checklist

> Goal: Implement deterministic, testable grid mechanics for 4e using **Chebyshev distance**, terrain costs, occupancy rules, and clean separation between **preview** and **commit**. Keep everything pure in `tactics/` & `rules/`; bgio moves are thin wrappers that apply returned patches.

---

## Status at a glance
- [ ] B1 Board representation & coordinates
- [ ] B2 Distance & adjacency metric
- [ ] B3 Terrain & occupancy rules
- [ ] B4 Pathfinding & cost model
- [ ] B5 Reachable cells & measurement
- [ ] B6 Movement actions (Walk/Move, Shift, Run, Stand Up)
- [ ] B7 Forced movement (Push/Pull/Slide)
- [ ] B8 Preview vs Commit pipeline
- [ ] B9 OA warning hooks (detection only)
- [ ] B10 Structured logging for movement
- [ ] B11 Patch ops used by movement
- [ ] B12 Acceptance tests green
- [ ] B13 Milestone B — Definition of Done

---

## B1) Board representation & coordinates
**Define a canonical, serializable board model.**

- [ ] `G.board = { w, h, blockers:Set<cellId>, difficult:Set<cellId>, positions:{ [actorId]: {x,y} } }`
- [ ] `cellId` canonical form: `\"x,y\"` (string). Helpers: `toId({x,y})`, `fromId(id)`
- [ ] Bounds helpers: `inBounds({x,y}, {w,h}) -> boolean`
- [ ] Occupancy helpers: `occupiedCells(G)`, `isOccupied(G, cell)`, `actorAt(G, cell)`
- [ ] Positions are **single-source-of-truth** (no duplicates elsewhere)

**DoD:** Round-trip `cell -> id -> cell` works; all helpers are pure and unit-tested.

---

## B2) Distance & adjacency metric
**Use 4e distance: every step (orthogonal or diagonal) costs 1.**

- [ ] `chebyshev(a, b) -> number` (max of |dx|, |dy|)
- [ ] Neighbors: `neighbors8(cell)` includes diagonals for topology; `neighbors4(cell)` available if needed
- [ ] Movement **range** uses Chebyshev; template math will reuse this later

**DoD:** Metric is symmetric and obeys triangle inequality in tests.

---

## B3) Terrain & occupancy rules (MVP policy)
**Keep rules minimal but true to 4e feel; expand later.**

- [ ] **Walls/Blockers**: impassable
- [ ] **Difficult terrain**: costs 2 per square (does not affect forced movement)
- [ ] **Allies**: may move **through** allied spaces but **cannot end** there
- [ ] **Enemies**: cannot move **through** enemy spaces; cannot end there
- [ ] **Shift**: cannot enter difficult terrain (MVP simplification matches 4e baseline)
- [ ] **Bounds**: movement must remain within `{w,h}`

**DoD:** `legalStep(from,to,mode)` enforces the above rules.

---

## B4) Pathfinding & cost model
**Find least-cost paths with blockers and terrain costs.**

- [ ] Implement A* (or Dijkstra) over `neighbors8` with:
  - [ ] **Cost** per step: `1` or `2` if `to` is in `difficult`
  - [ ] **Heuristic**: Chebyshev distance
  - [ ] **Impassable** if `to` is blocker or (occupied by enemy or occupied by any actor when ending)
- [ ] Hook for **ally pass-through** (allowed if not final cell)
- [ ] Return `{ path: Cell[], cost }` or `null` if no path

**DoD:** Unit tests cover: cannot path through walls; ally pass-through allowed; path cost accounts for difficult terrain.

---

## B5) Reachable cells & measurement
**Compute all cells reachable with a given speed budget.**

- [ ] `reachable(G, actorId, speed, options) -> Set<cellId>`
  - [ ] Uses the same cost rules as B4
  - [ ] Excludes enemy-occupied cells; includes ally cells only if **not final**
- [ ] Provide `explainReachable` (optional) returning frontier layers for UI highlights

**DoD:** Increasing speed never reduces the reachable set (monotonicity test).

---

## B6) Movement actions (Walk/Move, Shift, Run, Stand Up)
**Model standard movement choices with minimal flags.**

- [ ] `rules/move.walk(G, actorId, toCell)`:
  - [ ] Validates in-range path within **remaining Move actions**
  - [ ] Returns patches to update `positions`, spend `move`, and log
- [ ] `rules/move.shift(G, actorId, toNeighbor)`:
  - [ ] Exactly 1 square; cannot enter difficult terrain; cannot pass through enemies
  - [ ] Spends **move** (or **minor** if you later add feats; ignore for MVP)
- [ ] `rules/move.run(G, actorId, toCell)`:
  - [ ] Treat as walk but allow **+2 speed** (computed or via flag)
  - [ ] Sets `flags.ranThisTurn = true` (for CA in D/F later)
  - [ ] Same OA behavior as walk (B only shows warnings)
- [ ] `rules/move.standUp(G, actorId)`:
  - [ ] Removes `prone` condition (if present)
  - [ ] Spends **move** action; logs the transition

**DoD:** All four produce consistent patches; illegal moves return `{ok:false, reason}` without mutating `G`.

---

## B7) Forced movement (Push/Pull/Slide)
**No OA; not affected by difficult terrain. Stop if blocked.**

- [ ] `rules/forced.push(G, sourceId, targetId, n)`:
  - [ ] Move `target` **away from `source`** one square at a time, choosing the valid path that maximizes distance; stop on obstruction
- [ ] `rules/forced.pull(G, sourceId, targetId, n)`:
  - [ ] Move `target` **toward `source`** one square at a time; stop adjacent or on obstruction
- [ ] `rules/forced.slide(G, sourceId, targetId, n, chooser)`:
  - [ ] Move `target` **any direction** per step via a provided chooser function (UI may select)
- [ ] Common rules:
  - [ ] Cannot move through **blockers** or **enemy-occupied** cells
  - [ ] May pass through **allies** but cannot end there
  - [ ] Never provokes OA (B scope: no OA generated; F will handle OAs globally)

**DoD:** Exactly **N** steps applied unless blocked sooner; final cell legal.

---

## B8) Preview vs Commit pipeline
**Always compute a preview before mutating state.**

- [ ] `previewMove(G, actorId, toCell, mode) -> { path, cost, warns: string[] }`
- [ ] `commitMove(G, actorId, preview) -> Patch[]`
- [ ] Warnings include: “ends in occupied cell”, “provokes OA” (see B9), “out of range”, “blocked path”
- [ ] bgio `moves.moveToken` calls preview → if ok, applies returned patches

**DoD:** UI can highlight preview path, then commit; engine stays pure.

---

## B9) OA warning hooks (detection only, not enforcement)
**Detect potential OA triggers; do not resolve them here.**

- [ ] `detectOAFromMovement(G, moverId, path) -> { provokers: actorId[], cells: cellId[] }`
  - [ ] Use basic **threat range = 1** (read from `reach` later)
  - [ ] Trigger when leaving a threatened cell **without shifting**
- [ ] Add warnings from B8 using this detection
- [ ] **Do not** open prompts or apply damage here; that’s **F**

**DoD:** Moving out of melee range shows a clear OA warning in preview.

---

## B10) Structured logging for movement
**Make replays and tests readable.**

- [ ] Log types: `move-preview`, `move-commit`, `forced-move`, `stand`, `run-flag`
- [ ] Include `{ actorId, from, to, path, cost }` in `data`
- [ ] No RNG used in B; `rng` field omitted

**DoD:** Snapshots show a single commit log per applied move.

---

## B11) Patch ops used by movement
**Keep to the small set defined in A.**

- [ ] `set` — positions update: `actors.A1 -> {x,y}` lives in `G.board.positions`
- [ ] `inc` — optional step counters (if you add them)
- [ ] `merge` — set `flags.ranThisTurn = true`
- [ ] `log` — movement events

**DoD:** Movement never mutates state directly; only via patches.

---

## B12) Acceptance tests (green before C)
- [ ] **Chebyshev:** `chebyshev(a,b)` equals expected for orth/diag combos
- [ ] **Walls:** Cannot path through blockers; preview returns blocked warning
- [ ] **Difficult terrain:** Path cost reflects `2` when entering difficult cells
- [ ] **Allies:** Pass-through allowed; cannot end on ally
- [ ] **Enemies:** Cannot pass through or end on enemy
- [ ] **Reachable monotonic:** `reachable(speed+1)` ⊇ `reachable(speed)`
- [ ] **Shift:** Exactly 1 step; fails into difficult terrain
- [ ] **Run:** Extends max distance by 2; sets `flags.ranThisTurn`
- [ ] **Forced move:** Push/pull/slide apply exactly `n` or stop when blocked
- [ ] **OA detection (warn):** Leaving a threatened cell (not shifting) yields warning list of provokers
- [ ] **Serialization:** Preview does not mutate `G`; commit applies only declared patches

---

## B13) Milestone B — Definition of Done
- [ ] All B tests pass under `bun test`
- [ ] A small text map (10×10) and two actors can:
  - [ ] Walk/Shift/Run/Stand Up with correct previews and commits
  - [ ] Show OA warnings when appropriate
  - [ ] Apply push/pull/slide from sample powers (manual invocation OK)
- [ ] Logs clearly describe each movement
- [ ] No direct mutations; all through patches
- [ ] Engine remains UI-agnostic (no Pixi dependency)

---

## Notes & simplifications for MVP
- Difficult terrain does **not** affect forced movement
- Shift cannot enter difficult terrain (baseline 4e)
- Allies pass-through is allowed; enemies are impassable; refine for squeezing/elevation later
- OA handling is **warnings-only** here; resolution is milestone **F**

---

## Next after B (preview)
- **C: Targeting & geometry** — implement templates: single, close blast N, close burst N, area burst N within X; simple LoE
- **D (part):** basic charge skeleton can reuse B’s preview/commit while invoking a melee basic attack after move

> Tip: Keep `tactics/` pure and side-effect free. Movement performance issues? Cache `difficult` and `blockers` as `Set<string>` and precompute neighbor lists per board size.
