# 4e Mini‑VTT — MVP **D: Attack & Defense Resolution** Checklist

> Goal: Deterministic, rules‑accurate resolution of attacks in 4e: **d20 vs AC/Fort/Ref/Will**, hit/miss/effect pipelines, **basic crits**, damage application (including **temp HP, resistance, vulnerability, immunity**), and **Combat Advantage**. Consume staged targeting from C; spend actions from A; keep all math explainable via structured logs. Typed bonus edge cases are deferred to P1.

---

## Status at a glance
- [ ] D1 Data contracts: AttackSpec, DamageSpec, AttackContext
- [ ] D2 Legality & action economy gates
- [ ] D3 To‑hit modifiers (including CA & cover flags)
- [ ] D4 d20 roll semantics (nat 1 / nat 20, crit policy)
- [ ] D5 Hit / Miss / Effect pipeline
- [ ] D6 Damage roll & combination
- [ ] D7 Damage application (temp HP, resist/vuln/immune, min 0)
- [ ] D8 Multi‑target & multi‑attack sequencing
- [ ] D9 Charges, MBAs/RBAs (skeletons)
- [ ] D10 Logging for attacks (structured & reproducible)
- [ ] D11 Patch ops used by attacks
- [ ] D12 Acceptance tests green
- [ ] D13 Milestone D — Definition of Done

---

## D1) Data contracts: AttackSpec, DamageSpec, AttackContext
**Normalize how powers declare attacks & damage. Importer maps Foundry JSON → these.**

- [ ] `AttackSpec`
  - [ ] `kind: 'melee-weapon'|'ranged'|'close'|'area'|'implement'|'weapon'`  \n    *(weapon/implement hint for proficiency/enhancement application)*
  - [ ] `vs: 'AC'|'Fort'|'Ref'|'Will'`
  - [ ] `ability: 'STR'|'DEX'|'CON'|'INT'|'WIS'|'CHA'` *(for attack bonus and/or damage mod)*
  - [ ] `proficiency?: number` *(from weapon)*, `enhancement?: number`
  - [ ] `reach?: number`, `range?: number` *(consumed in C; echoed here for validation)*
- [ ] `DamageSpec` (supports simple sums for MVP)
  - [ ] `formula: RollSpec` *(e.g., `1[W] + STR + 2` → AST formed by importer)*
  - [ ] `type?: 'fire'|'cold'|'radiant'|...` *(for resist/vuln/immune)*
  - [ ] `halfOnMiss?: boolean`
- [ ] `PowerResolution`
  - [ ] `attack?: AttackSpec`
  - [ ] `hit?: { damage?: DamageSpec, riders?: EffectSpec[] }`
  - [ ] `miss?: { damage?: DamageSpec, riders?: EffectSpec[] }`
  - [ ] `effect?: EffectSpec[]` *(applies regardless of hit/miss)*
- [ ] `AttackContext` (built at runtime; pure)
  - [ ] `attackerId, defenderId, powerId`
  - [ ] `bonuses: { power: number, item: number, feat: number, untyped: number }` *(MVP collapse to `flat` if preferred)*
  - [ ] `flags: { combatAdvantage?: boolean, cover?: 'none'|'cover'|'superior', concealment?: 'none'|'conceal'|'total' }`
  - [ ] `staged: { center?, facing?, targets[] }` *(from C)*
  - [ ] `weaponOrImplement?: { proficiency, enhancement, [W], properties[] }`

**DoD:** Schemas validated (e.g., Zod). Importer populates `AttackSpec/DamageSpec` from your 4e JSON.

---

## D2) Legality & action economy gates
**Block illegal resolutions before rolling dice.**

- [ ] `canUsePower(G, attackerId, powerId, context)` verifies:
  - [ ] Action available (Standard/Move/Minor/etc.) based on the power’s action
  - [ ] Targeting preview from C was legal (range & LoE already checked)
  - [ ] Ammo/consumable gating if applicable (optional MVP)
- [ ] `spendAction(G, kind)` patch emitted on **commit** (not preview)

**DoD:** Illegal attempts return `{ ok:false, reason }` without mutating `G`.

---

## D3) To‑hit modifiers (including CA & cover flags)
**Compute a single attack bonus and a transparent breakdown.**

- [ ] `computeAttackBonus(G, ctx, spec) -> { total, parts }`
  - [ ] Base = `halfLevel` (optional MVP) + `abilityMod` + `proficiency?` + `enhancement?`
  - [ ] + `bonuses.flat` (MVP collapse of item/feat/power)
  - [ ] + `+2` if `flags.combatAdvantage`
  - [ ] − `2/5` for cover/concealment flags (from manual flags set in C; no auto‑cover yet)
- [ ] Output `parts`: `{ label, value }[]` for logs

**Tradeoff:** For MVP, **typed stacking** not enforced; highest‑of‑type comes in P1.

**DoD:** Breakdown sums to `total` in tests; CA and cover flags alter total as expected.

---

## D4) d20 roll semantics (nat 1 / nat 20, crit policy)
**Deterministic roll; disclose seed & index; enforce 4e crit basics.**

- [ ] `rollToHit(G, ctx) -> { d20, total, crit: boolean, autoMiss: boolean, patches }`
  - [ ] `d20 = roll('d20')`; `autoMiss = (d20 === 1)`; `crit = (d20 === 20)`
  - [ ] **Nat 20** → auto‑hit and **max damage dice**; add static bonuses normally
  - [ ] **Nat 1** → auto‑miss regardless of total
- [ ] No advantage/disadvantage in 4e; **rerolls** (e.g., Elven Accuracy) will be handled in P1/F later via prompts

**DoD:** Tests for 1 and 20 behave regardless of modifiers.

---

## D5) Hit / Miss / Effect pipeline
**Single place that orchestrates the full resolution.**

- [ ] `resolveAttack(G, ctx, spec) -> { patches, log }`
  1. Validate legality (D2)
  2. Compute attack bonus (D3)
  3. Roll to hit (D4) → short‑circuit on nat 1 / nat 20
  4. Compare vs defender’s defense (AC/Fort/Ref/Will)
  5. Apply **effect** (always‑on) riders, then **hit** or **miss** riders
  6. Compute and apply damage (D6/D7)
  7. Spend the action (A) and append logs
- [ ] Return patches only; bgio move applies them

**DoD:** Pipeline produces identical results under replay (same seed & cursor).

---

## D6) Damage roll & combination
**Parse & evaluate damage expressions deterministically with clear math.**

- [ ] `evaluateDamage(G, ctx, DamageSpec) -> { rolled, static, total, parts, patches }`
  - [ ] Support tokens in AST: `NdX`, `[W]` (weapon dice), `abilityMod`, `flat`
  - [ ] On **crit**: **maximize dice** in `NdX` and `[W]`; still add static; **enhancement dice** and High Crit are **P1**
  - [ ] Support `halfOnMiss` by halving the **pre‑mitigation** total (round down) per 4e basics
  - [ ] Multiple damage components (e.g., `2d6 fire + 1d6 cold`) can be flattened in MVP to single type or evaluate sequentially (choose one policy and log it)

**DoD:** Damage AST for `1[W] + STR + 2` yields expected totals given a known weapon and ability mod.

---

## D7) Damage application (temp HP, resist/vuln/immune, min 0)
**Apply to defender cleanly with patch operations.**

- [ ] `applyDamage(G, defenderId, amount, type?) -> { final, consumedTemp, resisted, vulnerable, patches }`
  - [ ] Temp HP absorbs first; remainder reduces `hp.current`
  - [ ] `immune[type]` → damage becomes `0`
  - [ ] `resist[type]` subtracts amount (min 0)
  - [ ] `vulnerable[type]` adds amount
  - [ ] Minimum damage **0** after mitigation (unless a power says otherwise; MVP ignore edge cases)
- [ ] Auto‑update bloodied flag when `hp.current <= max/2`
- [ ] Add `ongoing` effects separately via riders (E will tick them)

**DoD:** Unit tests cover temp HP precedence and resist/vuln/immune math.

---

## D8) Multi‑target & multi‑attack sequencing
**Roll separately per target; keep logs per defender.**

- [ ] For **multi‑target** powers (burst/blast/area or “choose N targets”):
  - [ ] Build a **separate context** per defender; compute bonus per defender (cover flags may differ)
  - [ ] Roll to hit for each defender independently
  - [ ] Apply hit/miss riders and damage to each defender
- [ ] For **multi‑attack** powers (e.g., Twin Strike):
  - [ ] Execute the above **sequence** multiple times; log attack index `1/2/...`
  - [ ] Spend action once unless the power states otherwise

**DoD:** Two targets yield two attack rolls and separate damage lines in logs.

---

## D9) Charges, MBAs/RBAs (skeletons)
**Provide primitives; full rules (e.g., charge restrictions) can expand later.**

- [ ] **Melee Basic Attack (MBA)** and **Ranged Basic Attack (RBA)** defined as data rows in content
  - [ ] MBA: `kind: 'melee-weapon', vs: AC, ability: STR, [W] from main weapon`
  - [ ] RBA: `kind: 'ranged', vs: AC, ability: DEX or per class`
- [ ] **Charge skeleton**:
  - [ ] Uses movement from B, ends with **MBA**; in MVP, skip +1 bonus or impose it via a flag you can add later
  - [ ] OA warnings handled by B (warn only) / F (resolve later)

**DoD:** You can invoke MBA/RBA and a simple charge for smoke‑test scenarios.

---

## D10) Logging for attacks (structured & reproducible)
**Every step is auditable and replayable.**

- [ ] Log types: `attack-preview`, `attack-roll`, `attack-result`, `damage-roll`, `damage-apply`, `rider-apply`
- [ ] Include in `attack-roll`: `{ attackerId, defenderId, powerId, d20, bonusParts, total, defense }` and `{ rng:{seed, idx} }`
- [ ] `damage-roll`: dice parts (rolled or maxed on crit) with AST serialization
- [ ] `attack-result`: `hit|miss|crit`, reasons (e.g., `NAT1`, `NAT20`, `TOTAL<DEFENSE`)
- [ ] `damage-apply`: `{ before:{ hp,temp }, after:{ hp,temp }, resist, vuln, immune, final }`

**DoD:** Snapshot tests match the full sequence for a simple power.

---

## D11) Patch ops used by attacks
**Use the small set from A.**

- [ ] `log` — all steps above
- [ ] `merge` — update actor flags (`bloodied`), set `ranThisTurn` earlier if using charge
- [ ] `set` — HP/Temp HP fields
- [ ] `add`/`remove` — attach/detach effect instances from hit/miss/effect riders
- [ ] `inc` — optional counters (e.g., times used for an encounter power; P1)

**DoD:** No direct mutations; only patches are applied.

---

## D12) Acceptance tests (green before E)
- [ ] **Hit vs defense:** bonus breakdown + d20 result yields correct hit/miss
- [ ] **Nat 20:** auto‑hit & max dice; static still added
- [ ] **Nat 1:** auto‑miss regardless of bonus
- [ ] **Half on miss:** damage halved before mitigation (round down)
- [ ] **Temp HP precedence:** temp absorbs first
- [ ] **Resist/Vuln/Immune:** math correct; min 0 enforced
- [ ] **CA & cover flags:** +2 for CA; −2/−5 for cover/concealment as flagged
- [ ] **Multi‑target:** independent rolls & damage per defender
- [ ] **Crit across multi‑target:** only targets with nat 20 get crit damage
- [ ] **MBA/RBA:** basic attacks resolve with expected stats
- [ ] **Serialization:** same seed and action order → identical results (cursor advances as expected)

---

## D13) Milestone D — Definition of Done
- [ ] All D tests pass under `bun test`
- [ ] You can:
  - [ ] Use a staged selection (from C) to execute an attack
  - [ ] See clear bonus breakdowns and crit/miss handling
  - [ ] Apply damage with temp HP, resist/vuln/immune rules
  - [ ] Resolve multi‑target attacks correctly
- [ ] Logs fully explain every roll and math step
- [ ] Engine remains UI‑agnostic; no Pixi dependency required

---

## Notes & simplifications for MVP
- Typed bonus stacking is **collapsed** to a single flat bucket; true typed stacking (power/feat/item/untype) in P1
- **High Crit** and **+Xd6 on crit** enhancements are P1
- **Reliable** powers, rerolls (Elven Accuracy), and **Immediate** effects that modify attacks are deferred to **F/P1**
- Damage types with multiple components may be flattened in MVP; document chosen policy in logs

---

## Next after D (preview)
- **E: Conditions & ongoing effects** — attach/remove conditions, `save ends`, ongoing damage ticking at turn boundaries
- **F: OA & immediates** — detect OA (from B) and open/resolve immediate windows that can modify attacks (e.g., *Shield*), one immediate per round

> Tip: Keep `resolveAttack` strictly orchestration over **pure helpers**. Make the math transparent and snapshot‑friendly; when you add typed stacking in P1, your breakdown structure stays unchanged—only the calculator grows.
