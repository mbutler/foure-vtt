# 4e Mini-VTT — MVP **G: Healing & Defeat** Checklist

> Goal: Implement faithful **healing & defeat** mechanics for 4e: **healing surges & Second Wind**, **temp HP**, **bloodied**, **dying/stable/dead**, **death saves**, and simple **stabilize** via Heal. Keep everything deterministic, pure, and logged. Integrate with A (turn timing), D (damage), and E (conditions/flags).

---

## Status at a glance
- [ ] G1 Actor health model & flags
- [ ] G2 Surge economy & Second Wind
- [ ] G3 Healing application pipeline
- [ ] G4 Temporary hit points (THP)
- [ ] G5 Bloodied & thresholds
- [ ] G6 Dying/stable/dead state machine
- [ ] G7 Death saving throws (end of turn)
- [ ] G8 Stabilize via Heal (skill assist)
- [ ] G9 Logging for healing & defeat
- [ ] G10 Patch ops used by G
- [ ] G11 Acceptance tests green
- [ ] G12 Milestone G — Definition of Done

---

## G1) Actor health model & flags
**Canonical, serializable health fields on each actor.**

- [ ] `hp: { current: number, max: number, temp: number }`
- [ ] `surges: { remaining: number, value: number }` *(value is ~¼ max HP; importer computes)*
- [ ] `death: { failures: 0|1|2|3, stabilized: boolean }`
- [ ] `flags: { bloodied: boolean, dying: boolean, dead: boolean, ranThisTurn?: boolean }`

**DoD:** Flags derive consistently from `hp.current` and transitions (see G6).

---

## G2) Surge economy & Second Wind
**Rules-accurate surge spend; one Second Wind per encounter.**

- [ ] `spendSurge(G, actorId, { multiplier=1, bonus=0 }) -> { healed, patches }`
  - [ ] If `surges.remaining > 0`: decrement; heal `surges.value * multiplier + bonus`
  - [ ] If `surges.remaining === 0` and a **power requires a surge**: **MVP policy (4e)** set `hp.current` to **1** at minimum when that heal resolves (see G3)
- [ ] `secondWind(G, actorId)`:
  - [ ] **Standard action** (A handles spend)
  - [ ] Spend **1 surge**, heal accordingly
  - [ ] Gain **+2 to all defenses** until **start of your next turn** (E can set a transient flag)
  - [ ] **Once per encounter** → track `actors[actorId].flags.usedSecondWind = true` and reset on extended rest (out of scope for MVP engine)

**DoD:** After Second Wind, defenses show +2 via flags; surges decrement; heal applied.

---

## G3) Healing application pipeline
**Normalize how healing effects change HP and interact with dying.**

- [ ] `applyHealing(G, actorId, amount, { requiresSurge=false, allowOverflow=true }) -> patches`
  1. If `flags.dead` → **no effect** (log)
  2. If `requiresSurge`:
     - [ ] Attempt `spendSurge`; if none remain, **set to 1 HP** minimum (MVP policy faithful to 4e) and continue
  3. If `hp.current < 0`, **raise to 0** first, then add `amount`
  4. If `allowOverflow === false`, cap at `hp.max`
  5. Clear `flags.dying` and `death.stabilized`, reset `death.failures = 0`
  6. Recompute `flags.bloodied`
- [ ] Healing **does not** affect THP (never “heals” temp)

**DoD:** Healing from negative HP uses “raise to 0 then heal” and ends dying.

---

## G4) Temporary hit points (THP)
**Buffer against damage; don’t stack with themselves.**

- [ ] `gainTempHP(G, actorId, amount) -> patches`
  - [ ] Set `hp.temp = max(hp.temp, amount)`; do not add
- [ ] `applyDamage(G, ...)` (from D) **first** consumes `temp`, then normal HP
- [ ] **MVP policy:** THP do **not** make an unconscious/dying creature conscious (they don’t change `hp.current`)
  - [ ] If a dying, stabilized, or unconscious creature takes damage that is **fully absorbed** by THP, they **did not take damage** for death save failure purposes

**DoD:** THP behavior matches tests; higher THP overwrites lower.

---

## G5) Bloodied & thresholds
**Automatic bloodied flag and instant-death threshold.**

- [ ] `flags.bloodied = (hp.current <= floor(hp.max / 2))`
- [ ] **Instant death** when damage reduces `hp.current` to **negative bloodied** value (i.e., `hp.current <= -floor(hp.max/2)`)
- [ ] On death: set `flags.dead = true`, `flags.dying = false`, clear all ongoing effects (E) and prompts (F) related to this actor

**DoD:** Tests for negative-bloodied instant death pass.

---

## G6) Dying/stable/dead state machine
**Consistent transitions with minimal states.**

- [ ] **Drop to 0 or fewer HP** → set `flags.dying = true`, `death.stabilized = false`, `unconscious = true` (implicit in UI), leave `hp.current` as-is (can be ≤ 0)
- [ ] **Healed** → clear `flags.dying`, set `hp.current` per G3, `death.failures = 0`, `death.stabilized = false`
- [ ] **Stabilized** (G8) → `death.stabilized = true`, remain **unconscious at current HP** (usually 0 or less)
- [ ] **Takes damage while stabilized** → `death.stabilized = false`, `flags.dying = true` (resume death saves)
- [ ] **Dead** → `flags.dead = true` (no further saves/heals unless house rules)

**DoD:** Round-trip through these states aligns with logs and tests.

---

## G7) Death saving throws (end of **your** turn)
**Flat DC 10; track failures; nat 20 surge.**

- [ ] `deathSave(G, actorId) -> { d20, outcome: 'fail'|'no-change'|'surge', patches }`
  - [ ] **When:** at **end of target’s own turn** if `flags.dying && !death.stabilized`
  - [ ] **1–9**: increment `death.failures` by 1
  - [ ] **10–19**: no change
  - [ ] **20+**: the creature **spends a healing surge** and becomes conscious (prone); **if no surges remain, condition doesn’t change** (still dying)
- [ ] On reaching **3 failures** before a rest → **dead**
- [ ] Log roll with RNG disclosure and outcome

**DoD:** Known seeds produce expected sequences; nat 20 logic matches spec.

---

## G8) Stabilize via Heal (skill assist)
**Allies can stop death saves without healing.**

- [ ] `stabilize(G, targetId, healerId, { dc=15 })` (First Aid: Stabilize the Dying)
  - [ ] On success: set `death.stabilized = true`; target remains unconscious; HP unchanged
  - [ ] On failure: no change
  - [ ] If target later **takes damage**, they cease to be stabilized and resume death saves
- [ ] `allowSecondWind(G, targetId, healerId)` (First Aid: Use Second Wind)
  - [ ] Healer DC 10 lets target spend **Second Wind** immediately **without** using their action and **without** the +2 defenses bonus

**DoD:** Skill assists update state correctly and produce logs.

---

## G9) Logging for healing & defeat
**Audit every change.**

- [ ] Log types: `heal-apply`, `surge-spend`, `second-wind`, `temp-apply`, `bloodied-enter`, `bloodied-exit`, `drop-to-0`, `death-save`, `stabilize`, `die`, `revive`
- [ ] `heal-apply` includes `{ before:{ hp,temp }, after:{ hp,temp }, source?, requiresSurge, usedSurge }`
- [ ] `death-save` includes `{ d20, outcome, failures }` and RNG index
- [ ] `drop-to-0` captures damage event that caused it (link to D log id)

**DoD:** Snapshot shows coherent sequence for drop → saves → heal/revive.

---

## G10) Patch ops used by G
**Reuse the minimal set from A.**

- [ ] `set` — HP/Temp HP fields; flags (`dying`, `dead`, `bloodied`, `death.stabilized`)
- [ ] `merge` — adjust defenses for Second Wind window; merge counters
- [ ] `inc` — increment `death.failures`
- [ ] `log` — healing/defeat events
- [ ] `add`/`remove` — clear ongoing effects on death (E integration)

**DoD:** No direct mutations; all changes via patches.

---

## G11) Acceptance tests (green before H)
- [ ] **Second Wind:** heals surge value; +2 defenses until start of next turn; once per encounter
- [ ] **Healing from negative:** raise to 0 then add amount
- [ ] **Requires surge but none left:** set to 1 HP minimum for that heal (policy), end dying
- [ ] **Temp HP precedence:** temp absorbs first; higher temp overwrites lower
- [ ] **THP & dying:** gaining THP doesn’t wake you; damage fully absorbed by THP doesn’t add a failed death save
- [ ] **Bloodied:** flag toggles correctly on crossing ½ max HP
- [ ] **Drop to 0:** sets dying; log created
- [ ] **Death save 1–9:** adds one failure
- [ ] **Death save 10–19:** no change
- [ ] **Death save 20+:** spend surge; if none, no change
- [ ] **Three failures:** dead
- [ ] **Stabilize DC 15:** stops death saves; damage breaks stabilization
- [ ] **Instant death:** negative-bloodied threshold kills outright
- [ ] **Serialization:** JSON round-trip preserves state/flags

---

## G12) Milestone G — Definition of Done
- [ ] All G tests pass under `bun test`
- [ ] You can:
  - [ ] Use Second Wind and see defense buff window
  - [ ] Heal allies (surge-based or not) and recover from dying correctly
  - [ ] Track temp HP correctly across hits
  - [ ] Run death save sequences including nat 20 surge recovery
  - [ ] Stabilize an ally with Heal and resume death saves on damage
- [ ] Logs fully explain each transition (drop → saves → heal/revive or death)
- [ ] Engine stays UI-agnostic; no Pixi dependency required

---

## Notes & simplifications for MVP
- Natural healing (short/extended rest) is out-of-scope for MVP; add later as out-of-combat utilities
- Exact class features that modify Second Wind (e.g., Dwarven racial, feats) are P1
- Leader powers that heal **without** spending a surge can call `applyHealing` with `requiresSurge=false`
- If you prefer stricter RAW: some tables treat **no surge on death save 20** as “no change”; this checklist follows that approach and sets **1 HP minimum** only for heals that *require* a surge (not for the death save itself)

---

## Next after G (preview)
- **H: Minimal UI** — buttons for Second Wind & Heal checks, clear death-save prompts, concise HP/THP displays, and log inspectors

> Tip: Write **golden tests** for 3 representative flows:  
> 1) Drop to 0 → fail, fail, 20 → surge up → stand up next turn  
> 2) Drop to 0 → stabilize → take damage → resume saves  
> 3) Massive hit to negative-bloodied → dead (no saves)
