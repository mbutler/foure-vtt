# 4e Mini-VTT — MVP **H: Minimal UI** Checklist

> Goal: A **laser‑focused, minimal UI** that lets 4e players run tactical combat fast. Client talks to the headless rules via **boardgame.io moves**. Rendering uses **PixiJS** for grid/tokens; panels are a thin React (or vanilla) shell. Everything follows **preview → commit** and supports **manual override**. Keep it desktop‑first, keyboard‑friendly, and testable.

---

## Status at a glance
- [ ] H1 UX principles & constraints
- [ ] H2 Client architecture & directories
- [ ] H3 Pixi scene (grid, tokens, highlights)
- [ ] H4 Modes & input model
- [ ] H5 Panels (initiative, sheet, powers)
- [ ] H6 Action bar & turn controls
- [ ] H7 Targeting preview (templates, LoE/range hints)
- [ ] H8 Prompts for OAs/Immediates
- [ ] H9 Effects chips & counters
- [ ] H10 Combat log & math inspector
- [ ] H11 Manual override (patch console)
- [ ] H12 Keyboard shortcuts & power users
- [ ] H13 Network/session glue (bgio client)
- [ ] H14 Error states & toasts
- [ ] H15 Accessibility & responsiveness
- [ ] H16 Performance budgets
- [ ] H17 Acceptance tests green
- [ ] H18 Milestone H — Definition of Done

---

## H1) UX principles & constraints
**Design guardrails so scope stays tight.**

- [ ] **Grid‑first**: 80% of the screen is the map; panels collapse
- [ ] **One thing at a time**: mode cursor & single active prompt
- [ ] **Explainable**: every action yields a readable log entry
- [ ] **Reversible**: undo via bgio; manual override always available
- [ ] **Minimal chrome**: no theme picker, no compendium browser (MVP)

**DoD:** A single screen runs a turn without hidden UI.

---

## H2) Client architecture & directories
**Keep UI modular; rendering isolated.**

```
src/
  render/           # Pixi-only: stage, grid, tokens, overlays
    stage.ts
    grid.ts
    tokens.ts
    highlights.ts
    adapters/bgioClient.ts
  ui/               # Panels & controls (React or vanilla)
    App.tsx
    panels/Initiative.tsx
    panels/Sheet.tsx
    panels/Powers.tsx
    panels/Log.tsx
    overlays/Prompt.tsx
    controls/ActionBar.tsx
  state/            # Client-only UI state (modes, selections)
    uiState.ts
    selectors.ts
```

- [ ] **No rules here**; only call bgio moves and read `G`

**DoD:** Client compiles with bun; no server rebuild needed for UI tweaks.

---

## H3) Pixi scene (grid, tokens, highlights)
**The only graphics you need for MVP.**

- [ ] Grid layer: tiles, coordinates (optional subtle labels)
- [ ] Token layer: creature sprites or colored circles with initials
- [ ] Highlight layer:
  - [ ] Reachable cells (B)
  - [ ] Template footprint (C)
  - [ ] Threat zones (F, optional toggle)
- [ ] Camera: pan with right‑drag, wheel zoom (clamped)
- [ ] Hit areas: per cell & per token

**DoD:** 60 FPS on a modest map (e.g., 30×30) with 20 tokens.

---

## H4) Modes & input model
**Deterministic inputs; no magic.**

- [ ] Modes: **Move**, **Target**, **Template**, **Measure**
- [ ] Cursor hint changes per mode
- [ ] Input pipeline (no mutation):
  - [ ] Pointer/down → build **intent** (`{ type:'move'|'target'|'template', data }`)
  - [ ] Send intent to preview function (B/C)
  - [ ] Show highlights & warnings
  - [ ] On confirm (click/Enter) → call bgio move to **commit**
- [ ] Escape cancels preview; mode persists

**DoD:** You can predict what click/drag does from the mode indicator.

---

## H5) Panels (initiative, sheet, powers)
**Thin, data‑driven, anchored to `G`.**

- [ ] **Initiative**: list with active highlight and next/prev buttons
- [ ] **Sheet** (selected actor):
  - [ ] HP/Temp HP, Surges, Defenses (AC/F/R/W), Conditions chips
  - [ ] Second Wind & Heal buttons (G)
- [ ] **Powers**:
  - [ ] Grouped by `At‑Will / Encounter / Daily / Utility`
  - [ ] Disabled when illegal (D2/Action economy)
  - [ ] Hover → show template; click → enter Target/Template mode as needed

**DoD:** Switching selected actor updates panels instantly.

---

## H6) Action bar & turn controls
**Minimal controls, always visible.**

- [ ] Action slots: **Standard**, **Move**, **Minor**, **Free** (show remaining)
- [ ] **End Turn** button (disabled when prompts open)
- [ ] **Spend action** affordances (e.g., Stand Up uses Move)
- [ ] Indicators: **Dazed/Stunned** alter slot availability

**DoD:** Action counts and disabled states reflect A/E rules.

---

## H7) Targeting preview (templates, LoE/range hints)
**Visualize C’s results clearly.**

- [ ] Template footprint overlay (burst/blast/area)
- [ ] Range rings & out‑of‑range dimming
- [ ] LoE breaks draw as dashed or red cells
- [ ] Candidate targets highlighted; non‑candidates dimmed
- [ ] Warnings: friendly fire, includes self, cover/conc flags (manual)

**DoD:** Users can tell *why* a target is illegal from on‑screen hints.

---

## H8) Prompts for OAs/Immediates
**Small, queue‑driven modal/inline prompts.**

- [ ] Prompt shows **who** can react and **why**
- [ ] Options: **Use** [power] / **Skip**
- [ ] Timer/ordering indicator (which reactor is next)
- [ ] Only one active prompt; others queue
- [ ] Decline advances to next eligible reactor

**DoD:** OA/Interrupt flows are obvious and unblock the turn.

---

## H9) Effects chips & counters
**Concise, informative, and clickable.**

- [ ] Chips on tokens with:
  - [ ] Icon/abbr (DZ, STN, IMM, SLOW, WKN, PRN, BLN, INV, MRK)
  - [ ] Counter for **save ends** (dot or “S”) and for duration (1/2)
- [ ] Hover chip → tooltip with full text & source
- [ ] Click chip (GM): remove effect (uses `applyManualPatch`)

**DoD:** Players can read conditions at a glance.

---

## H10) Combat log & math inspector
**Everything explainable, nothing hidden.**

- [ ] Compact list with icons: 🎲 attack, 💥 damage, 🛡 save, ➕ heal, ⚠️ warn
- [ ] Click to expand a line and see:
  - [ ] d20 roll, bonus breakdown, defense, result
  - [ ] damage dice/crit maxing, mitigation (resist/vuln/immune)
  - [ ] RNG disclosure `{ seed, idx }`
- [ ] Filter: All / Your actor / System

**DoD:** A resolved power shows a complete, human‑readable breakdown.

---

## H11) Manual override (patch console)
**Escape hatch for any table ruling.**

- [ ] Button opens a minimal editor:
  - [ ] Common toggles: prone, mark, add/remove temp HP, set HP
  - [ ] Freeform patch JSON textarea (with schema help)
- [ ] Apply sends `applyManualPatch` bgio move, logs as `manual-override`

**DoD:** Any ruling is doable in two clicks without code.

---

## H12) Keyboard shortcuts & power users
**Fast, predictable bindings.**

- [ ] `M` Move mode, `T` Target mode, `G` Measure
- [ ] `Q/E` rotate blast facing
- [ ] `1/2/3` select action slot (Std/Move/Minor)
- [ ] `Enter` commit preview; `Esc` cancel
- [ ] `.` End Turn (when legal)

**DoD:** Shortcuts survive focus changes and are documented in a help modal.

---

## H13) Network/session glue (bgio client)
**Thin client for state sync & moves.**

- [ ] Connect using `boardgame.io/client` with transport to your server
- [ ] Reconnect & desync handling (simple: reload on mismatch)
- [ ] Local player ID controls which tokens are interactive
- [ ] Spectator mode (read-only) is allowed

**DoD:** Two tabs can view the same match; only the owner can act for their actor.

---

## H14) Error states & toasts
**Never fail silently.**

- [ ] Preview errors show inline reasons (from C/D/B/F validators)
- [ ] Commit errors show toast with retry/copy‑error
- [ ] Server disconnect toast with auto‑retry

**DoD:** Errors are visible and actionable.

---

## H15) Accessibility & responsiveness
**Desktop‑first but not hostile.**

- [ ] High‑contrast mode toggle (CSS class)
- [ ] Token focus ring & keyboard navigation for panels
- [ ] Respect reduced motion (no heavy animations)
- [ ] Layout scales to 1280×720 and up; minimal support for 1024×640

**DoD:** App usable without a mouse for panels; grid interaction remains mouse‑centric.

---

## H16) Performance budgets
**Stay smooth on modest hardware.**

- [ ] ≤ 3ms per frame for highlight recompute (cache sets, reuse graphics)
- [ ] Debounce expensive previews (pathfinding) to on‑pointer‑up or every N pixels
- [ ] Use object pools for Pixi Graphics; avoid re‑creating Text each frame
- [ ] Cap line‑of‑sight rays per preview to a reasonable max (template cells only)

**DoD:** Maintain 60 FPS on 30×30 with 20 tokens and a blast preview.

---

## H17) Acceptance tests (green before ship)
- [ ] **Move flow:** mode → preview → commit; OA prompt appears when applicable
- [ ] **Target flow:** select power → template preview → pick targets → commit
- [ ] **Interrupt flow:** hit → *Shield* prompt → flip to miss when chosen
- [ ] **Healing:** Second Wind button spends surge, buffs defenses, logs correctly
- [ ] **Manual override:** set HP, add prone; state & log update
- [ ] **Undo:** last action undone by bgio, RNG cursor restored in log
- [ ] **Reconnect:** reload resumes in same match; UI state rebuilt from `G`

---

## H18) Milestone H — Definition of Done
- [ ] Client connects to running server and reflects `G`
- [ ] Grid renders with tokens & highlights; smooth pan/zoom
- [ ] Panels show initiative, sheet, powers; action bar reflects action economy
- [ ] Targeting visuals and warnings match C
- [ ] Prompts resolve OA/Immediate flows per F
- [ ] Log is complete and debuggable; math inspector clickable
- [ ] Manual override works and is logged
- [ ] All H tests pass under `bun test` (component/integration where applicable)
- [ ] No rules leaked into UI; all mutations via bgio moves

---

## Notes & simplifications for MVP
- Desktop only; mobile/touch later
- No dynamic lighting/FoW; no audio
- No compendium/character builder; assume actors are preloaded
- Minimal theming; CSS variables set but no theme UI

---

## Next after H (preview)
- **Importer polish & data entry tools**
- **Zones & auras (P1)** with overlays in Pixi
- **Cover/concealment auto‑evaluator (P1)** with geometry hints

> Tip: Treat the UI as a *viewer* plus *intent emitter*. All rules stay in the kernel; the client should be easy to rewrite without changing game logic.
