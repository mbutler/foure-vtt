# 4e Mini‑VTT — MVP **A: Engine Backbone** Checklist

> Goal: Lock down a deterministic, testable engine core using **bun** + **boardgame.io**. Keep the rules kernel pure, serializable state, and minimal moves. This doc is your day‑to‑day checklist.

---

## Status at a glance
- [ ] A1 Canonical game state (G)
- [ ] A2 Deterministic RNG contract
- [ ] A3 Turn & phase semantics
- [ ] A4 Duration model & saves
- [ ] A5 Exposed bgio moves
- [ ] A6 Patch format & applier
- [ ] A7 Structured logging
- [ ] A8 Rules kernel surface
- [ ] A9 Acceptance tests green

---

## A1) Canonical game state (G)
**Define and initialize a fully serializable `G`** (no functions). Start the match with a seed.

- [ ] `G.matchId` (string)
- [ ] `G.rng = { seed: number, cursor: number }`
- [ ] `G.round = 1`
- [ ] `G.turn = { order: actorId[], index: 0 }`
- [ ] `G.actions = { standard: 1, move: 1, minor: 1, free: 'unbounded', immediateUsedThisRound: false }`
- [ ] `G.actors` dictionary (hp/defenses/speed/reach/flags/conditions[])
- [ ] `G.board = { w, h, blockers:Set<cellId>, difficult:Set<cellId>, positions:{[actorId]:{x,y}} }`
- [ ] `G.effects` map by instanceId (condition, source, target, duration, appliedAt)
- [ ] `G.queue` (OA/Immediate events) and `G.prompts.current?`
- [ ] `G.log` array and `G._ts` monotonic counter

**Definition of Done:** `initialState(seed)` yields this shape; JSON.stringify/parse round‑trips without loss.

---

## A2) Deterministic RNG contract
**Make randomness replayable and debuggable.**

- [ ] Implement `utils/prng.js` → `(seed, cursor) => { nextFloat, cursor' }`
- [ ] `rules/roll(G, spec)` returns `{ result, parts, patches }`
  - [ ] Bump `rng.cursor` via patch
  - [ ] Emit `log` entry with `{seed, idx}`
- [ ] Supported specs: `'d20'`, `'d6'`, `{kind:'sum', terms:[...]}` (simple AST to grow later)

**DoD:** Rolling the same spec on the same `G` (same seed/cursor) yields the same total and identical `rng.cursor` progression after undo/redo.

---

## A3) Turn & phase semantics
**Wire deterministic turn flow with begin/end hooks.**

- [ ] `advanceTurn(G)` orchestrates: `onTurnEnd(active)` → advance index/round → `onTurnBegin(next)`
- [ ] `onRoundBegin/End` fire when index wraps (optional logs in MVP)
- [ ] `onTurnBegin` resets `actions` then applies condition‑based mutations (dazed/stunned)
- [ ] `onTurnEnd` runs **save‑ends** for that actor and expires `start/endOfSourceNext`
- [ ] Swap policy encoded (Standard→Move, Standard→Minor, Move→Minor)
- [ ] `canEndTurn(G)` ensures no open prompts/queues

**DoD:** N calls to `advanceTurn` cycle order correctly; logs show one begin and one end per turn.

---

## A4) Duration model & saves
**Track effect instances and resolve saves at the correct timing.**

- [ ] Duration kinds: `saveEnds | endOfSourceNext | startOfSourceNext | encounter`
- [ ] Actors reference effects by **instanceId** only
- [ ] `runEndOfTurnSaves(G, targetId)`
  - [ ] Iterate only `saveEnds` instances on target
  - [ ] Roll once per instance (10+ succeeds)
  - [ ] Remove on success; log each roll
- [ ] Same‑named condition replaces latest (MVP simplification)

**DoD:** Two independent `saveEnds` on one actor roll separately and can clear independently.

---

## A5) Exposed boardgame.io moves (thin wrappers)
**Expose only small, composable moves; keep rules pure.**

- [ ] `setInitiative(order: actorId[])`
- [ ] `endTurn()` → validates and calls `advanceTurn`
- [ ] `spendAction(kind)` → rules validate + patches; emit warning log if illegal
- [ ] `applyManualPatch(patch)` → escape hatch for GM
- [ ] Stubs: `openImmediate`, `resolveImmediate`, `openOA`, `resolveOA`

**DoD:** Moves mutate `G` only through patches from rules and always log.

---

## A6) Patch format & applier
**Keep patches tiny and test‑friendly.**

- [ ] Support ops: `set`, `inc`, `merge`, `add`, `remove`, `log`
- [ ] Path addressing: dot‑paths (`actors.A1.hp.current`)
- [ ] Idempotent applier (no throws on missing paths; create parents as needed)
- [ ] Unit tests for each op

**DoD:** Golden patch tests pass; applier never inserts functions into `G`.

---

## A7) Structured logging
**Everything important is explainable and replayable.**

- [ ] `LogEntry = { ts, actorId?, type, msg, data?, rng? }`
- [ ] Types used in A: `turn-begin | turn-end | save | info`
- [ ] `ts` increments for every append
- [ ] Helpers to compose human‑readable `msg` and machine‑readable `data`

**DoD:** Snapshot tests match logs; any random event includes `{seed, idx}`.

---

## A8) Rules kernel surface (pure)
**Public pure functions you call from bgio moves.**

- [ ] `initialState(seed): G`
- [ ] `advanceTurn(G): Patch[]`
- [ ] `canSpendAction(G, kind): { ok, reason }`
- [ ] `spendAction(G, kind): Patch[]`
- [ ] `applyDurationTick(G, timing): Patch[]`
- [ ] `roll(G, spec): { result, parts, patches }`

**DoD:** No function references live in `G`; all helpers return patches + optional side‑effect logs.

---

## A9) Acceptance tests (green before B)

- [ ] **Init:** `initialState(42)` → `round=1`, `turn.index=0`, `rng.cursor=0`
- [ ] **Turn sequence:** repeated `advanceTurn` wraps order and increments round
- [ ] **Action swaps:** Standard→Move/Minor and Move→Minor; invalid swaps warn
- [ ] **Dazed:** at turn begin, actions reduced to `standard=1, move=0, minor=0`
- [ ] **Saves timing:** `saveEnds` roll at **end of target’s turn**, not source’s
- [ ] **Undo:** rolling then undoing restores `rng.cursor` for the next identical roll
- [ ] **No prompts open:** `endTurn` rejected if `prompts.current` exists

---

## Milestone A — Definition of Done
- [ ] Server runs; `/games` lists `4e`
- [ ] All A‑series unit tests pass under `bun test`
- [ ] Manual sanity: start a match, set initiative, step through several turns, observe begin/end logs
- [ ] RNG disclosure visible in logs for any roll
- [ ] Code layout matches module map (engine/rules/tactics/content)

---

## Notes & simplifications for MVP
- Same‑named condition **replaces** (no stacking) → revisit in P1
- Typed bonus stacking deferred (single flat bucket only)
- Prompts/interrupts are **queued** but not deeply nested yet
- Cover/concealment handled manually (geometry in B/C later)

---

## Next after A (preview)
- **B: Grid & movement** — Chebyshev distance, pathing, shift/run, OA warnings
- **C: Targeting & geometry** — templates (single/blast/burst), simple LoE
- **D: Attack & defense** — d20 vs defenses, basic crits, damage pipeline
- **E: Conditions & ongoing** — core condition set, save‑ends
- **F: OA & immediates** — trigger detection, one immediate per round
- **G: Healing & defeat** — surges, temp HP, death saves
- **H: Minimal UI** — grid, action bar, sheet, log, manual overrides

> Tip: check items off in order; avoid touching B while A’s acceptance tests are red. This keeps scope tight and iteration fast.

