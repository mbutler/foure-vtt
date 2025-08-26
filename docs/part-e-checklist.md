# 4e Mini-VTT — MVP **E: Conditions & Ongoing Effects** Checklist

> Goal: Implement deterministic, 4e-faithful **conditions** and **ongoing damage** with correct **timing** (`save ends`, `start/end of source's next turn`, `encounter`), clean **attach/remove** semantics, and **action-economy** impacts (e.g., **dazed**, **stunned**). Keep rules pure; only return patches and structured logs. Defer typed-bonus stacking and exotic riders to P1.

---

## Status at a glance
- [ ] E1 Data contracts (Condition, EffectInstance)
- [ ] E2 Canonical condition catalog (MVP set)
- [ ] E3 Attach / remove lifecycle
- [ ] E4 Duration kinds & timers
- [ ] E5 Saving throws (flat 10+) at end of turn
- [ ] E6 Action-economy modifiers (dazed, stunned) application
- [ ] E7 Movement/targeting modifiers (immobilized, slowed, prone, blinded, invisible, restrained, weakened)
- [ ] E8 Ongoing damage (tick at **start** of turn)
- [ ] E9 Mark & defender basics (flag only, enforcement later)
- [ ] E10 Sustain mechanics (minor/move/standard) for persistent effects
- [ ] E11 Immunities/resistances/vulnerabilities interplay
- [ ] E12 Logging for effects
- [ ] E13 Patch ops used by effects
- [ ] E14 Acceptance tests green
- [ ] E15 Milestone E — Definition of Done

---

## E1) Data contracts (pure JSON)
**Normalize how conditions and effects are represented so they’re testable and serializable.**

- [ ] `Condition` (catalog row; static data)
  - [ ] `id: string` (e.g., `"dazed"`)
  - [ ] `flags: {}` minimal mechanical flags, e.g.:
    - [ ] `actions?: { standard?: 1|0, move?: 1|0, minor?: 1|0 }`
    - [ ] `cannotShift?: boolean`, `speed0?: boolean`, `grantCA?: boolean`, `hasCA?: boolean`
    - [ ] `attackDisadv?: boolean` *(not 4e term; model as flat penalty if needed)*
    - [ ] `targeting: { cannotTarget?: 'enemies'|'allies'|'any' }` *(rare; MVP likely unused)*
  - [ ] `tags?: ('control'|'visibility'|'movement'|'defender'|'status')[]`
- [ ] `EffectInstance` (live attachment)
  - [ ] `id: string` (instance id)
  - [ ] `conditionId: string` *(or `'ongoing-damage'` special)*
  - [ ] `source: actorId`, `target: actorId`
  - [ ] `duration: { kind: 'saveEnds'|'endOfSourceNext'|'startOfSourceNext'|'encounter' }`
  - [ ] `appliedAt: { round: number, turnActorId: actorId }`
  - [ ] `data?: { amount?: number, type?: string, sustain?: 'minor'|'move'|'standard' }` *(for ongoing/sustain)*
  - [ ] `meta?: { replacedInstanceId?: string }` *(if replacing same-named condition)*
- [ ] Helpers (pure):
  - [ ] `makeEffectInstance(G, {conditionId, source, target, duration, data})`
  - [ ] `serializeEffect`, `deserializeEffect` *(optional; JSON-safe by default)*

**DoD:** Zod schemas (or similar) validate these; importer maps Foundry JSON to catalog rows.

---

## E2) Canonical condition catalog (MVP set)
**Implement the most common 4e conditions first.** Keep semantics minimal but correct.

- [ ] **Action economy / control:**
  - [ ] `dazed` → Only 1 **standard** action; no **minor** or **immediate**; cannot flank; grants CA
  - [ ] `stunned` → No actions; grants CA; drop sustain unless specified otherwise
  - [ ] `dominated` → *(P1)* control effects (skip for MVP)
- [ ] **Mobility:**
  - [ ] `immobilized` → speed=0 (teleport/forced ok)
  - [ ] `slowed` → speed capped at 2 (or speed = min(speed, 2))
  - [ ] `prone` → melee attackers gain CA? *(4e: melee +2 attack vs prone; ranged -2 vs prone)* → **MVP:** apply a simple `grantCATo: 'melee'` flag, and leave ranged penalty to P1
  - [ ] `restrained` → speed=0, grant CA, cannot shift
- [ ] **Visibility / targetability:**
  - [ ] `blinded` → grants CA to attackers; target takes -5 to Perception *(*MVP ignore skills*)*; enemies have total concealment → **MVP:** attackers gain CA; ranged attacks suffer manual cover flags if desired
  - [ ] `invisible` → has CA against non-blind targets; ignores concealment penalties **against** them *(MVP: simple `hasCA` flag)*
- [ ] **Offense dampeners:**
  - [ ] `weakened` → deals half damage (round down) on attacks that deal damage
- [ ] **Defender:**
  - [ ] `marked` → flag only (enforcement in F/P1), usually -2 to attacks not including marker; OA/immediate punishments are class-specific → **MVP:** store `markedBy: actorId`
- [ ] **State markers:**
  - [ ] `bloodied` → not an effect instance; computed flag when hp ≤ ½ max (handled in D/G)
- [ ] **Ongoing damage**: modeled as effect with `conditionId: 'ongoing-damage'` & `data:{ amount, type }`

**DoD:** Catalog entries exist and unit tests assert their flag impacts on action economy and damage (for weakened).

---

## E3) Attach / remove lifecycle
**Consistent, idempotent helpers; same-named condition replaces.**

- [ ] `applyCondition(G, {conditionId, source, target, duration, data}) -> { patches, instanceId }`
  - [ ] If target already has an **instance with same `conditionId`**, **replace** it:
    - [ ] Remove old instance; attach new instance; store `meta.replacedInstanceId`
  - [ ] Attach instance id into `actors[target].conditions[]`
  - [ ] Emit log `condition-add`
- [ ] `removeCondition(G, instanceId) -> patches`
  - [ ] Remove instance from `G.effects` and from actor’s list
  - [ ] Emit log `condition-remove`
- [ ] Idempotency: calling `removeCondition` twice is safe (no throw)

**DoD:** Unit tests prove replacement policy and idempotency.

---

## E4) Duration kinds & timers
**Respect 4e timing windows.**

- [ ] `saveEnds` → roll at **end of target’s turn**
- [ ] `endOfSourceNext` → expire when **source** ends their **next** turn after application
- [ ] `startOfSourceNext` → expire when **source** starts their **next** turn after application
- [ ] `encounter` → persists; removable only by explicit effects/manual
- [ ] Tracking:
  - [ ] Record `appliedAt: { round, turnActorId }`
  - [ ] Tick helpers compare current turn actor vs `appliedAt.turnActorId`
- [ ] Helpers:
  - [ ] `tickStartOfTurn(G, actorId)` → returns patches to:
    - [ ] apply ongoing damage (E8)
    - [ ] expire any `startOfSourceNext` where `source === actorId`
  - [ ] `tickEndOfTurn(G, actorId)` → returns patches to:
    - [ ] roll `saveEnds`
    - [ ] expire any `endOfSourceNext` where `source === actorId`

**DoD:** Effects with different durations expire at the exact turn boundary intended.

---

## E5) Saving throws (flat 10+ at end of turn)
**Independent per effect; no stacking bonuses yet.**

- [ ] `savingThrow(G, instanceId) -> { success, d20, patches }` (uses RNG from A)
- [ ] Run at **end of target’s turn** for all `saveEnds` attached to that target
- [ ] No bonuses or penalties in MVP (e.g., Save +2 from feats) — **P1**
- [ ] Log each save with RNG disclosure and outcome

**DoD:** Two `saveEnds` effects produce two separate rolls and can clear independently.

---

## E6) Action-economy modifiers application
**Mutate available actions at turn begin based on active conditions.**

- [ ] At `onTurnBegin`, collect active condition instances on the **active actor**
- [ ] Compute an **action mask**:
  - [ ] `dazed` → `{ standard:1, move:0, minor:0 }`
  - [ ] `stunned` → `{ standard:0, move:0, minor:0 }`
  - [ ] Combine masks by taking the **minimum** for each slot (most restrictive wins)
- [ ] Set flags for `cannotShift`, `speed0`, etc., for movement rules in B

**DoD:** Unit tests for dazed and stunned enforce correct action budgets.

---

## E7) Movement/targeting modifiers
**Apply movement & accuracy adjustments via flags consumed by B/C/D.**

- [ ] Movement:
  - [ ] `immobilized` → speed = 0 (teleport/forced ok)
  - [ ] `slowed` → cap speed at 2
  - [ ] `restrained` → speed = 0, cannot shift
  - [ ] `prone` → standing up costs a **move** (B handles), melee attackers gain CA; ranged attack nuance deferred
- [ ] Targeting/accuracy:
  - [ ] `blinded` → attackers gain CA vs this target; defender may have trouble targeting (manual for MVP)
  - [ ] `invisible` → target has CA against others; others may need LoS adjustments **(MVP: keep geometry unchanged; only CA flags)**
  - [ ] `weakened` → damage halved after hit/miss determination (D applies using flag)
- [ ] Defender:
  - [ ] `marked` → store `markedBy: actorId`; actual penalty/enforcement in F/P1

**DoD:** Flags flow through to B (movement constraints) and D (CA and weakened) cleanly.

---

## E8) Ongoing damage (tick at **start** of target’s turn)
**Apply guaranteed damage at timing with proper mitigation.**

- [ ] Representation: `conditionId: 'ongoing-damage'`, `data:{ amount, type }`, `duration` as usual (e.g., `saveEnds`)
- [ ] `applyOngoingAtStart(G, actorId)`:
  - [ ] Sum or apply **each** ongoing instance separately (MVP policy: **sum by type** or **apply sequentially**; pick one and document)
  - [ ] For each component:
    - [ ] Mitigate using `immune/resist/vulnerable` (D7 rules)
    - [ ] Produce `damage-apply` logs
- [ ] No attack roll; this damage **does not** provoke OAs
- [ ] Save vs ongoing occurs at **end** of turn with other `saveEnds`

**DoD:** Actor with `ongoing 5 fire (save ends)` takes damage at start; a successful save at end removes it.

---

## E9) Mark & defender basics (flag only for MVP)
**Attach `marked` with a pointer to the source; enforcement later.**

- [ ] `applyMark(G, sourceId, targetId, duration)` → wrapper over `applyCondition(..., conditionId:'marked', data:{ by: sourceId })`
- [ ] When a new mark is applied, it **replaces** older mark instances on that target (one mark at a time policy)
- [ ] Enforcement of -2 to attacks not including the marker and punishments is **F/P1**

**DoD:** Target shows a single `marked` chip with source reference.

---

## E10) Sustain mechanics (for persistent effects)
**Maintenance costs at the end or during the turn.**

- [ ] Effects that require sustain carry `data.sustain: 'minor'|'move'|'standard'`
- [ ] At **end of turn**, if not sustained this turn, **expire** the effect
- [ ] Sustain action is a separate move that **spends** the required action kind
- [ ] Log `effect-sustain` when paid; `effect-expire` when not

**DoD:** An effect with `sustain:'minor'` persists only if the actor spends a minor that turn.

---

## E11) Immunities/resistances/vulnerabilities interplay
**Centralize mitigation logic; D already applies for attacks—reuse here.**

- [ ] `mitigateDamage(G, targetId, amount, type?)` shared by D & E
- [ ] **Immune** → 0; **Resist** subtracts; **Vulnerable** adds; min 0
- [ ] For multiple ongoings in one turn, mitigation applies per component according to chosen policy (E8)

**DoD:** Tests show consistent math between ongoing damage and attack damage.

---

## E12) Logging for effects
**Explain every attach, tick, save, sustain, and expire.**

- [ ] Log types: `condition-add`, `condition-remove`, `ongoing-apply`, `save-roll`, `save-success`, `save-fail`, `effect-sustain`, `effect-expire`
- [ ] Each includes `{ source, target, conditionId, duration, instanceId }`
- [ ] `save-roll` includes RNG disclosure `{ seed, idx }` and DC=10

**DoD:** Snapshot covers a full lifecycle: apply → tick → save → remove.

---

## E13) Patch ops used by effects
**Use the minimal set.**

- [ ] `add` — `effects[instanceId] = EffectInstance`
- [ ] `set` — toggle flags on actors (cached per turn), e.g., `actors.A1.flags.weakened = true`
- [ ] `merge` — update actor action masks at turn begin
- [ ] `remove` — delete instance and remove pointer from `actors[target].conditions[]`
- [ ] `log` — any of the events above

**DoD:** No direct mutations to `G`; only patches applied.

---

## E14) Acceptance tests (green before F)
- [ ] **Apply/Remove:** attaching a condition adds an instance; removing clears it and the actor pointer
- [ ] **Replace policy:** re-applying `dazed` replaces old instance and resets duration
- [ ] **Dazed/Stunned:** turn-begin action masks enforce budgets
- [ ] **Immobilized/Slowed:** movement helpers see correct caps/blocks
- [ ] **Weakened:** halves damage dealt by the affected attacker
- [ ] **Prone:** stand up costs a move (B), melee attackers gain CA flag
- [ ] **Ongoing:** damage ticks at **start**; save ends at **end**
- [ ] **Duration clocks:** `endOfSourceNext` and `startOfSourceNext` expire at correct boundaries
- [ ] **Sustain:** effect persists only if sustain action paid; otherwise expires
- [ ] **Serialization:** Effects survive JSON round-trip; instance ids stable
- [ ] **Determinism:** Saving throws consume RNG cursor predictably and disclose indices

---

## E15) Milestone E — Definition of Done
- [ ] All E tests pass under `bun test`
- [ ] You can:
  - [ ] Apply and remove core conditions with correct turn-boundary behavior
  - [ ] See action budgets change for `dazed`/`stunned`
  - [ ] Take and clear `ongoing` damage via `save ends`
  - [ ] Maintain a sustained effect across turns
- [ ] Logs tell the full story (apply → tick → save → expire)
- [ ] Engine remains UI-agnostic; no Pixi dependency required

---

## Notes & simplifications for MVP
- Same-named condition **replaces** (latest wins) to avoid stacking explosions
- Typed bonus stacking deferred; conditions set flags only
- **Prone**’s exact melee/ranged modifiers are simplified; precise numbers can be added in P1 via bonus calculators
- `dominated`, exhaustive visibility math, regeneration, and aura/zone persistence are P1

---

## Next after E (preview)
- **F: Opportunity & Immediate actions** — detect OA from B, open immediate windows (one per round per creature), and resolve interrupts/reactions that can modify attacks or movement
- **P1**: Zones & conjurations as persistent areas with onEnter/onStartTurn handlers; precise cover/concealment auto-evaluator

> Tip: Keep **effect evaluation** side-effect free—compute all changes first, emit **patches**, then apply. Your logs should always allow you (and a future you) to reconstruct *why* a condition existed and *when* it ended.
