# 4e Mini-VTT — MVP **C: Targeting & Geometry** Checklist

> Goal: Provide deterministic, testable targeting and template geometry for 4e powers. Implement core templates (single, melee reach, close **blast N**, close **burst N**, **area burst N within X**), simple **LoS/LoE**, and minimal cover/concealment handling. Keep everything pure in `tactics/` and `rules/`; bgio moves remain thin wrappers that apply returned patches.

---

## Status at a glance
- [ ] C1 Targeting & template data contracts
- [ ] C2 Origin & range semantics (melee, close, ranged, area)
- [ ] C3 Template generation algorithms
- [ ] C4 Facing & rotation (blasts)
- [ ] C5 Line of Sight (LoS) & Line of Effect (LoE)
- [ ] C6 Cover & concealment (MVP policy)
- [ ] C7 Target filters & selection rules
- [ ] C8 Auto-target discovery
- [ ] C9 Legality checks & error reasons
- [ ] C10 Preview pipeline & UX hints
- [ ] C11 Logging for targeting
- [ ] C12 Patch ops used by targeting
- [ ] C13 Acceptance tests green
- [ ] C14 Milestone C — Definition of Done

---

## C1) Targeting & template data contracts
**Normalize how powers describe where they can aim and who they can affect.** (Data, no UI)

- [ ] `TemplateSpec` (pure JSON)
  - [ ] `kind: 'single'|'blast'|'burst'` (for MVP)
  - [ ] `radius?: number` (burst only)
  - [ ] `size?: number` (blast only, N)
  - [ ] `origin: 'self'|'melee'|'ranged'|'area'`
  - [ ] `range?: number` (ranged & area; melee uses `reach`)
  - [ ] `requiresLoEToOrigin: boolean` (true for ranged & area)
- [ ] `TargetingSpec`
  - [ ] `who: 'any'|'enemies'|'allies'|'not-self'|'self'|'creatures'`
  - [ ] `minTargets?: number`, `maxTargets?: number` (default 1)
  - [ ] `allowDuplicates?: boolean` (usually false)
  - [ ] `includeSelf?: boolean` (for bursts/blasts that can affect the user)
- [ ] Helpers validate and coerce incoming data from your importer

**DoD:** Schemas exist, unit-tested, and importer maps Foundry JSON into these without throwing.

---

## C2) Origin & range semantics (melee, close, ranged, area)
**Define where templates anchor and how distance is checked (Chebyshev metric).**

- [ ] **Melee (single)**: origin at attacker’s cell; **reach** defines max distance (default 1)
- [ ] **Close burst N**: origin = attacker’s cell; cells within radius N (including origin) unless power says otherwise
- [ ] **Close blast N**: origin = any edge-adjacent “front” of attacker; contiguous N×N wedge outward (see C4)
- [ ] **Ranged single**: origin = attacker’s cell; pick target cell within `range`
- [ ] **Area burst N within X**: pick **center cell** within `range=X` from attacker; template is a **burst N** at that center
- [ ] **LoE requirement**: Ranged & Area require LoE to **origin** and from **origin to each target**. Close powers require LoE from the attacker to each target.

**DoD:** Range checks and origin rules are codified and unit-tested against examples.

---

## C3) Template generation algorithms
**Pure functions that return a `Set<cellId>` given a spec and anchor.**

- [ ] `cellsForSingle(anchor)` → `{anchor}`
- [ ] `cellsForBurst(center, radius)` → Chebyshev disk: `max(|dx|,|dy|) <= radius`
- [ ] `cellsForBlast(origin, facing, size)` → N-by-N footprint extending from the side adjacent to origin in `facing`
  - [ ] Clip to board bounds
  - [ ] Option: include/exclude origin per power (default exclude for blast)
- [ ] `cellsForTemplate(spec, attackerCell, opts)` combines the above based on `spec.kind` and `origin`
  - [ ] For Area: compute valid centers within range, pick one, then burst

**DoD:** Golden snapshot tests for typical sizes (burst 1/2/3, blast 3) pass and are rotation-agnostic.

---

## C4) Facing & rotation (blasts)
**Support 8-way orientation for blasts (N, NE, E, SE, S, SW, W, NW).**

- [ ] `facingFromVector(dx, dy)` quantizes to the nearest of 8 directions
- [ ] `rotateBlast(size, facing)` yields offsets to add to the origin edge
- [ ] UI can choose `facing`; rules accept it as a parameter
- [ ] MVP allows all 8 facings; refine later if you prefer 4 only

**DoD:** Rotating a blast by 90°/45° yields correctly transformed footprints (tests compare sets).

---

## C5) Line of Sight (LoS) & Line of Effect (LoE)
**Simple, deterministic grid ray-cast with 4e-friendly corner rules.**

- [ ] **Corner-to-corner rule (MVP):** A target has LoS if **any** corner of the origin cell can connect to **any** corner of the target cell without crossing a blocking edge
- [ ] LoE uses the same test; **blockers** and **opaque terrain** break LoE
- [ ] **Area:** must have LoE to the **chosen center** plus LoE from center → each target
- [ ] **Close:** LoE from attacker → each target
- [ ] Implementation approach:
  - [ ] Precompute segment/edge blockers from `board.blockers`
  - [ ] Use a supercover digital line algorithm (e.g., Bresenham variant) that samples edges, not just cell centers
  - [ ] Tie-break consistently when a line exactly grazes a corner (document policy)

**DoD:** Unit tests for LoS with walls, diagonal peeks, and grazing corners pass.

---

## C6) Cover & concealment (MVP policy)
**Defer precise categories; provide manual flags and soft penalties.**

- [ ] Engine supports **manual flags**: `hasCover`, `hasSuperiorCover`, `hasConcealment`, `hasTotalConcealment` per target
- [ ] Default auto-evaluator returns `none` (to be replaced in P1)
- [ ] Rules surface converts flags into attack modifiers: −2 (cover/concealment), −5 (superior/total)
- [ ] Log records any manual cover toggles

**DoD:** Attack preview shows modifiers when flags are set; geometry does not yet compute cover.

---

## C7) Target filters & selection rules
**Who can be targeted within the template.**

- [ ] Filters:
  - [ ] `enemies` / `allies` / `creatures` / `self` / `not-self`
  - [ ] Optional `uniqueById` (default true)
  - [ ] Optional `exclude: actorId[]`
- [ ] Count constraints: `minTargets`, `maxTargets`
- [ ] Multi-attack powers: allow **pick up to N** targets; selection is a subset of candidates
- [ ] Auto-exclude dead/unconscious (unless power says otherwise)

**DoD:** Filter tests pass (enemy-only burst excludes allies & self unless included).

---

## C8) Auto-target discovery
**Given a spec, compute legal candidates in order (for default selection).**

- [ ] `discoverTargets(G, attackerId, spec, choices) -> { templateCells, candidates: actorId[], reasons: string[] }`
  - [ ] Applies range & LoE checks per C2/C5
  - [ ] Applies `who` filter per C7
  - [ ] Returns reasons when no candidates are found (to surface in UI)

**DoD:** Deterministic candidate lists for the same board state (sorted by cell id or distance).

---

## C9) Legality checks & error reasons
**Always explain “why not” with stable error codes.**

- [ ] Error codes: `OUT_OF_RANGE`, `NO_LOE_TO_ORIGIN`, `NO_LOE_TO_TARGET`, `BLOCKED_ORIGIN`, `NO_CANDIDATES`, `FACING_REQUIRED`, `CENTER_REQUIRED`
- [ ] `validateTargeting(G, attackerId, spec, choices) -> { ok, errors[], warnings[] }`
- [ ] Warnings: friendly fire, includes self, cover/concealment present (manual)

**DoD:** Tests assert specific error codes for classic failure cases.

---

## C10) Preview pipeline & UX hints
**Preview before commit; UI-agnostic contract.**

- [ ] `previewTargeting(G, attackerId, spec, choices) -> { templateCells, targets, errors, warnings }`
  - [ ] `choices` may contain `{ center, facing, selectedTargets[] }`
- [ ] No state mutation; pure function; include hints like:
  - [ ] cells out of LoE (dimmed)
  - [ ] cells out of range (dimmed)
  - [ ] contested cells (e.g., target behind cover) as warnings only

**DoD:** Preview is deterministic given the same `G` and `choices`.

---

## C11) Logging for targeting
**Make it explainable and replayable.**

- [ ] Log types: `target-preview`, `template-choose`, `center-choose`, `facing-choose`
- [ ] Include `{ attackerId, spec, center?, facing?, templateCellsCount, candidateCount }`
- [ ] No RNG in C; omit `rng` field

**DoD:** Snapshots include one preview log per user preview and compact data.

---

## C12) Patch ops used by targeting
**Targeting itself is read-only; store only player choices when confirmed (later used by D).**

- [ ] `set` — store ephemeral `selection` under `G.ui` or `G.staging` (center/facing/targets) when user confirms
- [ ] `log` — record preview & choice events
- [ ] Avoid mutating actor state; resolving effects happens in **D**

**DoD:** Targeting patches never change HP/conditions/positions.

---

## C13) Acceptance tests (green before D)
- [ ] **Burst:** `burst 1/2/3` shapes correct around center; includes center
- [ ] **Blast:** `blast 3` footprints correct in all 8 facings; excludes origin by default
- [ ] **Area burst within X:** centers limited by range; cannot choose blocked center; LoE to center required
- [ ] **Range:** melee respects `reach`; ranged uses `range`; close ignores range
- [ ] **LoE:** wall between attacker and target blocks close/ranged; area requires LoE from center to target
- [ ] **No candidates:** returns `NO_CANDIDATES` with helpful reasons
- [ ] **Filters:** `enemies` only selects hostile actors; `includeSelf` works for self-bursts
- [ ] **Preview purity:** calling preview does not mutate `G`
- [ ] **Determinism:** two previews with same inputs produce identical outputs

---

## C14) Milestone C — Definition of Done
- [ ] All C tests pass under `bun test`
- [ ] You can:
  - [ ] Choose **center** for an **area burst** and see the footprint
  - [ ] Choose **facing** for a **blast** and see the footprint
  - [ ] See candidates highlighted and filtered correctly
  - [ ] Get clear reasons when a selection is illegal
- [ ] Logs describe previews and choices succinctly
- [ ] No direct mutations to combat state; only selection staging & logs
- [ ] Engine remains UI-agnostic (no Pixi dependency)

---

## Notes & simplifications for MVP
- Exact cover/concealment geometry deferred; use manual flags and warnings only
- Ties in LoS edge cases follow a documented policy; keep it consistent
- Walls & opaque terrain fully block LoE; transparent difficult terrain does not
- Template shapes clip to board bounds; no off-board cells

---

## Next after C (preview)
- **D: Attack & defense resolution** — consume staged center/facing/targets; roll to hit vs AC/Fort/Ref/Will; apply hit/miss/effect pipelines; basic crits and damage types
- **P1**: precise cover/concealment categories and auto-evaluator; zones & conjurations that provide their own LoE/Cover rules

> Tip: Keep `tactics/templates.ts` & `tactics/los.ts` completely pure. Golden snapshot tests for template shapes are your best defense against regressions when you later add rotations, squeezing, or map scaling.
