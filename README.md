# foure-vtt

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.17. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

# 4e Mini-VTT – MVP Guide (A–H)

## Vision & Constraints
**Purpose**: a minimal, fast, 4e-only VTT for running combats with players who already have their characters built elsewhere.

**Philosophy**: deterministic, testable core; strict separation of rules kernel (pure functions) from rendering (Pixi).

**MVP scope (A–H)**: only what you need for 95% of combats.

**Out of scope (MVP)**: dynamic lighting, typed bonus stacking edge-cases, complex readied/delayed edge-cases, rich automation.

---

## Target Stack
- **Runtime/build**: bun (scripts, test, bundling)  
- **State/turns/networking**: boardgame.io (server-authoritative, undo/replay)  
- **Renderer**: PixiJS (2D grid, tokens, highlights)  
- **UI shell**: lightweight React (or vanilla) for panels if you want—but keep it thin  
- **Tests**: bun test + deterministic RNG; snapshot logs  
- **Data**: Foundry 4e JSON → importer/mapper → normalized content store  

---

## Module Map (bird’s-eye)
- `rules/` (pure): game phases, actions, effects, saves, conditions  
- `tactics/` (pure): grid math, pathfinding, LoS/LoE, templates  
- `content/` (data): normalized powers/conditions/items/monsters from JSON  
- `engine/` (thin): boardgame.io config (moves, phases), RNG, patch application  
- `render/` (impure): Pixi scene, input → intents, draw grid/tokens/highlights  
- `ui/` (impure): initiative, power picker, log, overrides  
- `tests/` (pure-heavy): golden tests per power, scenario tests  

---

# MVP Features (A–H)

## A) Engine Backbone (headless)
**Goal**: phased turn structure, action economy, durations, deterministic RNG & undo.  
See detailed specs: phases, action economy, durations, RNG, interfaces, bgio bindings, tests, and acceptance criteria.

---

## B) Grid & Movement
**Goal**: square grid (Chebyshev distance), pathing, difficult terrain, forced movement, shift.  
Includes rules, interfaces, tests, and “done when” criteria.

---

## C) Targeting & Geometry
**Goal**: standard 4e templates, LoS/LoE.  
Covers templates, raycasting, cover/concealment, interfaces, tests, and criteria.

---

## D) Attack & Defense Resolution
**Goal**: d20 vs defenses, crits, damage, CA.  
Includes pipeline, interfaces, tests, and “done when”.

---

## E) Conditions & Ongoing Effects
**Goal**: core conditions, ongoing damage, saving throws.  
Covers stacking, interfaces, tests, UI chip display.

---

## F) Opportunity & Immediate Actions
**Goal**: OA triggers & immediate windows.  
Covers reach, interfaces, tests, and “done when”.

---

## G) Healing & Defeat
**Goal**: HP/temp HP, surges, second wind, death saves.  
Covers mechanics, interfaces, tests, and UI expectations.

---

## H) Minimal UI
**Goal**: smallest set of controls to run combat.  
Includes Pixi grid, initiative panel, action bar, log, manual overrides, interactions, tests.

---

# Data: Leverage Foundry 4e JSON
- **Importer** → map Foundry JSON into normalized schema  
- **Normalizer** → coerce into consistent shapes  
- **Catalog** → in-memory index  

Includes mapping table for: action types, ranges, defenses, formulas, keywords, effects, conditions, weapons/implements.  
Importer tasks: AST parser, validation, provenance.  

**Done when**: iconic powers (Cleave, Magic Missile, Tide of Iron, Thunderwave, Healing Word) run end-to-end.

---

# Directory Layout
```
/src
  /engine              # boardgame.io config & RNG plumbing
  /rules               # pure rules kernel (A–G)
  /tactics             # grid math, LoS, pathfinding, templates (pure)
  /content
    /importers/foundry # mappers/parsers for your JSON
    /catalog           # normalized JSON and indexes
  /render              # pixi scene graph & input → intents
  /ui                  # panels: sheet, initiative, log, prompts
  /utils               # RNG, patches, dice parser/AST, deep-freeze helpers
/tests
  /golden              # power fixtures and expected patches/logs
  /scenario            # OA/interrupt/mark etc. sequences
```

---

# Milestones & Definition of Done

- **Milestone 1** – Skeleton online (A + part of H)  
- **Milestone 2** – Movement slice (B + H)  
- **Milestone 3** – Targeting & single at-will (C + D + E + H)  
- **Milestone 4** – Effects & saves (E deeper)  
- **Milestone 5** – OA/Immediate (F)  
- **Milestone 6** – Healing & defeat (G)  
- **Milestone 7** – Importer (Data)  

Each milestone has clear DoD: from initiative tracking to OA prompts to content import.

---

# Testing Strategy
- Golden tests per power  
- Property tests for pathfinding, forced movement, save-ends distribution  
- Scenario tests for OA/interrupt/mark  
- RNG seeding for deterministic replay  

---

# Risk Controls & Simplifications
- Typed bonus stacking simplified (flat bonuses only)  
- Cover/concealment as manual toggles first  
- Interrupt storms: one immediate per round, FIFO  
- Complex class features deferred (marks, sustain, auras minimal)  

---

# Bun-friendly Project Hygiene
- Use `bunx` for scaffolding  
- Run `bun test` with watch; keep most logic pure  
- One dev script launches boardgame.io + client  

---

# First Curated Content Set
**Defender**: Cleave, Tide of Iron, Combat Challenge  
**Striker**: Twin Strike, Piercing Strike, Sly Flourish  
**Controller**: Thunderwave, Icy Terrain, Sleep  
**Leader**: Healing Word, Lance of Faith, Sacred Flame  
**Utilities**: Shield, Second Wind  

---

# Next Tasks
- Engine hooks → initiative, turn flow, RNG  
- Grid core → reachables, shift, OA detection  
- Template render → close blast/burst  
- One melee power → hit/miss, prone, save-ends  
- Importer v0 → load 10 powers  
- Immediate window → Shield test passes  
- Healing & defeat → Second Wind + death saves  
- UI polish → action bar, sheet, log, overrides  

---

# Rules Reference

## Action Economy
```yaml
actions_per_turn:
  standard: 1
  move: 1
  minor: 1
  free: infinite
  immediate_interrupt: 1
  immediate_reaction: 1
  opportunity_action: 1
action_swaps:
  standard_to_move: true
  standard_to_minor: true
  move_to_minor: true
  minor_to_move: false
  minor_to_standard: false
```

## Turn Structure
```yaml
round_loop:
  - start_of_round
  - initiative_order:
      - start_of_turn
      - perform_actions
      - end_of_turn
  - end_of_round
initiative_roll: "d20 + Dex modifier + bonuses"
```

## Duration Model
- **save_ends**: effect ends on d20 ≥ 10 at end of turn  
- **until_end/start of turn**: as written  
- **end_of_encounter**: persists until encounter ends  

## Grid & Movement
- Square grid (5 ft)  
- Walk, Shift, Teleport, Fly  
- Difficult terrain doubles cost  
- Diagonals cost 1  

## Targeting Templates
- Burst, Blast, Wall, Cone  
- Requires LoS/LoE, OA rules  

## Conditions & Ongoing Effects
Includes: dazed, stunned, dominated, prone, slowed, immobilized, restrained, blinded, deafened, unconscious, ongoing damage.  

---

# Monster Mechanics
- **Roles**: brute, soldier, artillery, lurker, skirmisher, controller  
- **Types**: standard, minion, elite, solo  
- **Defenses**: AC, Fort, Ref, Will  
- **Initiative**: d20 + Dex/Int  

---

# Power Structures
- Usage: at-will, encounter, daily, utility  
- Action types, keywords, components (attack, hit, miss, sustain, special)  

---

# Skill Challenges
- Complexity levels, DCs, aid another  
- Outcomes: success vs failure  

---

# Combat Resolution
- Attack roll, damage roll, crits, saves  
- Surprise round: standard only  
- Initiative rules  
- Combat end conditions  

---

