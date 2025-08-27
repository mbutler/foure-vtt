# Server-Authoritative Sync Roadmap

## Server-Authoritative Sync
- Switch UI to **Socket.IO multiplayer bgio client** (no local mutations).
- Create/persist **matchID + playerID** on load; reconnect gracefully.
- Remove **rules-shim** usage:
  - Import real game bundle (or built rules) instead of `/src` dev route.

---

## Game Moves (Server)
- **Token movement**
  - Add `moveToken` move (walk/shift/run) invoking `rules.move.*` and applying patches.
- **Core moves**
  - Expose `setInitiativeOrder`, `endTurn`, `spendAction`, `applyManualPatch`.
- **Healing**
  - Add `useSecondWind`, `applyHealing` moves (replace UI shim calls).
- **Attacks**
  - Add `resolveAttack` move for targeting commits (MBA/Burst/etc).

---

## UI Calls (Client)
- Replace all `Rules.applyPatches` calls with bgio moves:
  - `moveToken`, `spendAction`, `endTurn`, `useSecondWind`, `applyManualPatch`.
- Render exclusively from the **bgio store subscription**; remove direct writes to `G`.

---

## Targeting and Templates
- Use tactics-based previews (cells / LoE / range) for template overlays.
- Implement **Target commit flow**:
  1. Select targets  
  2. Call `resolveAttack` move  
  3. Show logs

---

## Prompts (F Integration)
- Read **OA/Interrupt/Reaction** state from `G.prompts.current` and `G.queue`.
- Implement moves: `resolveOA`, `resolveInterrupt`, `resolveReaction`.
- Wire **Use/Skip** handling.
- Disable **End Turn** button when a prompt is active.

---

## Panels and Action Bar
- **Action Bar**
  - Reflect `G.actions`; disable buttons when counts are zero.
- **Status Effects**
  - Dazed/stunned masks apply automatically from `G` (read mask flags) and mirror visually.
- **Initiative UI**
  - Set order via move.
  - Highlight active actor from `G.turn.index`.

---

## Log
- Render exclusively from `G.log`.
- Features:
  - Show icons
  - Roll disclosure
  - Filters: All / Actor / System

---

## Bundling & Deployment
- Remove **rules-shim** and `/src` dev-serving.
- Bundle client modules with **Bun** (or serve a built rules client module).
- Keep server static routes minimal:
  - Serve built assets only.

---

## Performance
- Throttle move preview pathfinding.
- Debounce `mousemove` to N ms/pixels.
- Cache/reuse **Pixi Graphics**; avoid excessive redraws.
- Clip **LoE checks** to template cells only.

---

## Accessibility & Polish
- Add **high-contrast toggle** and reduced-motion CSS.
- Add small **help modal reference** (shortcuts already present).

---

## Tests & Documentation
- Add **H acceptance tests**:
  - move / target / interrupt / heal / override / undo.
- Fix dev server restart/port handling.
- Document dev workflow:
  - `bun run dev` + client.

---

## Cleanup
- Remove unused imports and local mutable logging/ts increments.
- Consolidate icon mapping and styles.
- Ensure consistent, elegant UI.
