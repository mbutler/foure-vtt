# 4e Mini-VTT — MVP **F: Opportunity & Immediate Actions** Checklist

> Goal: Implement **Opportunity Attacks (OA)** and **Immediate Interrupt/Reaction** timing with a small, deterministic queue & prompt system. Enforce **one immediate per round per creature**, **one OA per turn per creature**, and resolve windows in a predictable order. Do not over-automate—MVP focuses on detection, prompts, and minimal resolution hooks that integrate with B (movement) and D (attacks).

---

## Status at a glance
- [ ] F1 Trigger taxonomy & timing windows
- [ ] F2 State model: queues, prompts, usage flags
- [ ] F3 OA detection rules (movement & ranged/area in melee)
- [ ] F4 OA resolution (MBA, reach, cancellation of movement)
- [ ] F5 Immediate interrupts (pre/post-hit windows)
- [ ] F6 Immediate reactions (post-resolution)
- [ ] F7 Usage limits: once-per-round (immediate), once-per-turn (OA)
- [ ] F8 Ordering & determinism
- [ ] F9 Integration points with B & D
- [ ] F10 Preview vs Commit for reactive actions
- [ ] F11 Logging for OAs & immediates
- [ ] F12 Patch ops used by F
- [ ] F13 Acceptance tests green
- [ ] F14 Milestone F — Definition of Done

---

## F1) Trigger taxonomy & timing windows
**Define the minimal set of reactive windows you’ll support in MVP.**

- [ ] **OA triggers**
  - [ ] **Movement OA**: a creature **leaves** a square **threatened** by an enemy **without shifting/teleporting** (B detects path segments)
  - [ ] **Ranged/Area OA**: a creature makes a **ranged** or **area** attack while **adjacent** to an enemy (D detects)
  - [ ] **No OA** from forced movement, shifting, or teleport
- [ ] **Immediate Interrupt** windows (occur **before** the triggering effect resolves)
  - [ ] **Attack-Hit** interrupt: *“when you are hit”* — open **after** attack roll determines a hit but **before** damage & riders
  - [ ] **Targeted** interrupt (optional MVP): *“when targeted”* — open **after targeting is chosen, before roll* (can be deferred to P1)
- [ ] **Immediate Reaction** windows (occur **after** the triggering effect resolves)
  - [ ] **After-Damage** reaction: *“when you take damage”* — open after damage apply
  - [ ] **After-Enemy-Moves** reaction (optional MVP): *“when an enemy moves away”* — can be deferred

**DoD:** Each trigger has a clearly defined **open** and **close** point in the B/D pipelines.

---

## F2) State model: queues, prompts, usage flags
**Add serializable state for reactive flow; no functions in `G`.**

- [ ] `G.queue: ReactiveEvent[]` (FIFO)
- [ ] `G.prompts.current?: { type, to: playerId, actorId, eventId, choices }`
- [ ] `G.flags.usage[actorId]: { immediateUsedThisRound: boolean, opportunityUsedThisTurn: boolean }`
- [ ] `ReactiveEvent = { id, kind: 'OA'|'INTERRUPT'|'REACTION', trigger: { type, data }, eligible: actorId[], status: 'open'|'resolved'|'skipped' }`

**DoD:** JSON round-trips; flags reset at correct boundaries (turn/round).

---

## F3) OA detection rules (movement & ranged/area in melee)
**Pure detection that returns deterministic results.**

- [ ] `detectOAFromMovement(G, moverId, path) -> { provokers: actorId[], cells: cellId[] }`
  - [ ] Threat range = **reach** of enemy (default 1)
  - [ ] Trigger when **leaving** a threatened cell without `shift`
  - [ ] **Once per enemy per movement** (no multiple OAs from the same enemy on one move)
- [ ] `detectOAFromAttack(G, attackerId, attackSpec) -> { provokers: actorId[] }`
  - [ ] If `attackSpec.kind` is `ranged` or `area` and attacker is **adjacent** to an enemy, that enemy may OA
- [ ] Output is **read-only**; no state changes here

**DoD:** Unit tests cover shift immunity, forced movement immunity, and adjacency checks.

---

## F4) OA resolution (MBA, reach, cancellation of movement)
**Resolve an OA as a standard **MBA** unless a creature has a specific OA definition.**

- [ ] `openOA(G, trigger) -> patches` creates a `ReactiveEvent` with `eligible` provokers
- [ ] `resolveOA(G, actorId, eventId, choice)`:
  - [ ] Enforce `opportunityUsedThisTurn === false`
  - [ ] Choose target (usually the mover/attacker)
  - [ ] Execute **MBA** via D’s `resolveAttack` using actor’s **melee basic** (data-driven)
  - [ ] Set `opportunityUsedThisTurn = true`
- [ ] **Movement interruption policy (MVP):**
  - [ ] If OA **drops** the mover to 0 or applies a condition that sets `speed=0` (e.g., `immobilized`), **cancel remaining path**
  - [ ] Otherwise, movement continues (no push/pull/slide interruption rules in MVP)

**DoD:** OA consumes usage flag and either cancels or allows movement to continue according to result.

---

## F5) Immediate interrupts (pre/post-hit windows)
**Open a window and allow at most one immediate per round per creature.**

- [ ] `openInterrupt(G, trigger)` → creates `ReactiveEvent(kind:'INTERRUPT')` with `eligible`
- [ ] `resolveInterrupt(G, actorId, eventId, choice)`:
  - [ ] Enforce `immediateUsedThisRound === false`
  - [ ] Apply the chosen interrupt effect:
    - [ ] **Defense buff** (e.g., *Shield*): `+4 AC` against the triggering attack only
    - [ ] **Attack modifier**: e.g., `-X` to attacker’s total, or force re-roll (re-rolls P1)
  - [ ] Re-evaluate hit/miss outcome if the interrupt changes totals
  - [ ] Set `immediateUsedThisRound = true`
- [ ] **Integration with D**:
  - [ ] After a hit is determined (pre-damage), open `Attack-Hit` interrupt window
  - [ ] If interrupt flips result to **miss**, skip hit riders & damage

**DoD:** A *Shield*-like interrupt turns a would-be hit into a miss when math says so.

---

## F6) Immediate reactions (post-resolution)
**Reactions occur after the triggering effect fully resolves.**

- [ ] `openReaction(G, trigger)` → `ReactiveEvent(kind:'REACTION')`
- [ ] `resolveReaction(G, actorId, eventId, choice)`:
  - [ ] Enforce `immediateUsedThisRound === false`
  - [ ] Apply effect (e.g., *Infernal Wrath*: deal damage to the attacker)
  - [ ] Set `immediateUsedThisRound = true`

**DoD:** After taking damage, an eligible reaction can fire and consumes the immediate usage.

---

## F7) Usage limits: once-per-round (immediate), once-per-turn (OA)
**Reset at the correct boundaries.**

- [ ] At **start of each creature’s turn**: `opportunityUsedThisTurn = false` for everyone
- [ ] At **start of round** (or end of each creature’s turn): `immediateUsedThisRound = false` for **that creature**
- [ ] Enforcement lives in `resolveOA` and `resolveInterrupt/Reaction`

**DoD:** Tests confirm limits are respected across multiple triggers within a round/turn.

---

## F8) Ordering & determinism
**When multiple creatures are eligible, resolve in a predictable order.**

- [ ] **Interrupts** resolve **before** reactions
- [ ] OAs are considered **interrupts** relative to the provoking step
- [ ] Among multiple eligible reactors, order prompts by:
  1. **Initiative order** (lowest index first), then
  2. **ActorId** lexicographically (tie-breaker)
- [ ] Only one prompt is `current` at a time; others wait in `queue`

**DoD:** Multi-eligible scenarios resolve in the same order across replays.

---

## F9) Integration points with B & D
**Add hooks but keep B/D pure.**

- [ ] **B (movement)**:
  - [ ] On `previewMove`, compute `detectOAFromMovement` and return warnings
  - [ ] On `commitMove`, if warnings exist, enqueue `OA` events **before** advancing along the path
- [ ] **D (attacks)**:
  - [ ] After attack roll determines `hit`, enqueue `INTERRUPT` event for defenders with relevant powers
  - [ ] After damage apply, enqueue `REACTION` events
- [ ] Enqueue only; **resolution happens via F moves** (`resolveOA/Interrupt/Reaction`)

**DoD:** B and D contain **no** prompt logic beyond enqueue.

---

## F10) Preview vs Commit for reactive actions
**Prompts preview choices; commit applies patches.**

- [ ] `previewReactiveChoice(G, eventId, actorId, choice) -> { effects, errors }`
  - [ ] Example: preview *Shield* shows new AC and whether it flips hit → miss
- [ ] `commitReactiveChoice(G, ...)` returns patches (set flags, modify staged attack context, logs)
- [ ] If a player declines, mark their participation and advance to next eligible reactor

**DoD:** Preview is pure and non-mutating; commit only via patches.

---

## F11) Logging for OAs & immediates
**Make reactive flows easy to audit.**

- [ ] Log types: `oa-open`, `oa-resolve`, `int-open`, `int-resolve`, `react-open`, `react-resolve`, `react-skip`
- [ ] Include `{ eventId, trigger, actorId, targetId, powerId?, result }`
- [ ] For **interrupts** that modify attacks, record both **before** and **after** totals/defense
- [ ] For OAs, include whether movement was cancelled and the remaining path length

**DoD:** Snapshot shows open → resolve (or skip) lifecycle with clear math.

---

## F12) Patch ops used by F
**Reuse the minimal set.**

- [ ] `add` — enqueue `ReactiveEvent` in `G.queue`
- [ ] `set` — `G.prompts.current`, usage flags
- [ ] `merge` — temporary defense buffs (e.g., AC+4 vs this attack) under a **scoped context** (not permanent on actor)
- [ ] `log` — all steps
- [ ] (Optional) `remove` — dequeue events when resolved

**DoD:** No hidden mutations; temporary buffs scoped to the event, not persisted on the actor.

---

## F13) Acceptance tests (green before G)
- [ ] **OA from movement:** leaving threatened square (not shifting) enqueues OA; resolving consumes OA and applies MBA
- [ ] **OA once-per-turn:** second OA attempt by same creature in same turn is rejected
- [ ] **Forced movement:** no OA enqueued
- [ ] **Ranged in melee:** ranged/area attack adjacent to enemy enqueues OA for that enemy
- [ ] **Interrupt (Shield):** post-hit interrupt flips hit to miss when math warrants
- [ ] **Reaction (after damage):** example reaction fires and consumes immediate for that round
- [ ] **Ordering:** two eligible reactors resolve in initiative order
- [ ] **Movement cancellation:** OA that drops target to 0 cancels remaining path
- [ ] **Determinism:** identical sequences produce identical logs and outcomes

---

## F14) Milestone F — Definition of Done
- [ ] All F tests pass under `bun test`
- [ ] You can:
  - [ ] Get OA warnings in move preview; on commit, see OA prompts in order
  - [ ] Resolve an OA as an MBA and see its effects immediately
  - [ ] Trigger and resolve a *Shield*-like interrupt that can negate a hit
  - [ ] Fire a simple reaction after damage
- [ ] Usage limits enforced (1 immediate/round, 1 OA/turn)
- [ ] Logs show clear, reproducible sequences
- [ ] Engine remains UI-agnostic; B/D unaffected except for enqueue hooks

---

## Notes & simplifications for MVP
- OA uses data-defined **MBA**; if absent, OA can be **skipped with a log** (`NO_MBA`)
- Interrupt variety is limited to **AC buff** or **attack total penalty** in MVP; rerolls & nested prompts are P1
- Opportunity actions are not suppressed by conditions in MVP (e.g., **dazed** typically does not allow immediate actions; OA is an **opportunity** action, not immediate — verify per class features in P1)
- Mark punishments and class-specific OA/interrupt riders are P1

---

## Next after F (preview)
- **G: Healing & Defeat** — surges, Second Wind, dying/death saves, stabilize
- **H: Minimal UI** — prompts modal/inline, log inspector, action bar buttons for OAs/Immediates

> Tip: Keep **reactive logic** small: *detect → enqueue → prompt → resolve*. Do not let resolution leak into B or D; instead, have F produce patches that **amend** D’s pending result (e.g., adjust defense total) or **cancel** remaining movement in B by writing to a shared `staging` field the move executor respects.
