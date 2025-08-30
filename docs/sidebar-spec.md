# 4e Mini-VTT — Sidebar Specification (Compact, Minimal, 4e-Tailored)

> Purpose: a **laser-focused sidebar** that shows only what’s necessary to run 4e turns fast. Small, deterministic, and optimized for action economy, powers, and conditions.

---

## Information Architecture (top → bottom)

1. **Reactive Bar** *(appears only when needed)*
2. **Actor Header** *(always visible)*
3. **Action Strip** *(always visible)*
4. **Context Drawer** *(toggle: `Powers | Status`)*
5. **Log Peek** *(1–2 latest lines; expand to full log)*

Default drawer: **Powers** on your turn; **Status** when viewing others.

---

## 1) Reactive Bar (only when needed)

**Purpose:** resolve OAs / Immediate Interrupts / Reactions inline, without modals.

* **Text:** `🛑 Immediate: <Actor> can use <Power> (vs <Trigger>).`
* **Buttons:** `Use` • `Skip` • `Details`
* **Displays:**

  * Small usage tag: `1/round` (disables `Use` with tooltip: *Immediate already used this round*)
  * Appears only for the eligible actor’s controller

---

## 2) Actor Header (minimal, 4e-specific)

**Row A — Identity**

* **Text:** `<Name>`
* **Badges:** `bloodied` • `dying` • `dead` *(mutually exclusive; clear colors)*

**Row B — Vital**

* **Displays:** `HP: <current>/<max>` • `Temp: <tempHP>` *(hide at 0)* • `Surges: <remaining>` *(hover: `=<value> HP each`)*
* **Button:** `Second Wind` *(disabled when used this encounter; tooltip explains)*

**Row C — Defenses**

* **Displays:** `AC` `Fort` `Ref` `Will`
* **Chip:** `+2 all (Second Wind)` *(auto-clears at start of next turn)*

---

## 3) Action Strip (turn economy at a glance)

**Row D — Slots**

* **Buttons (toggle; show remaining):** `Standard` `Move` `Minor`
* **Subchips (contextual):** `Shift` • `Stand Up` *(when Prone)* • `Sustain [Minor/Move/Std]` *(when required)*

**Row E — Turn Controls**

* **Buttons:** `Measure` • `End Turn` *(disabled if prompts open)* • `Override` *(GM only)*

*Notes:* Standard can convert to Move/Minor; `Run` is a move-preview toggle (not a persistent button).

---

## 4) Context Drawer (toggle: `Powers | Status`)

### Drawer Toggle

* **Segmented control:** `Powers | Status` *(default to Powers on active turn)*

---

### 4A) Powers Drawer

**Header**

* **Tabs:** `At-Will` `Encounter` `Daily` `Utility`
* **Filters (tiny):** `[Std] [Move] [Minor] [Free] [Immediate]` *(pre-selected to legal actions)*

**Power List (virtualized, minimal rows)**
Each row contains:

* **Left:** action glyph (`Std/Move/Minor/Free/Immediate`)
* **Main text:** `<Power Name>`
* **Subtext:** `<range/target summary>` *(“Melee 1 vs AC”, “Close blast 3”, “Area burst 1 within 10”)*
* **Badges (right):** `⚡ Encounter` *(dim if expended)* • `☾ Daily` *(dim if expended)* • `Sustain`
* **Button:** `Use` *(disabled if illegal; tooltip reason: “No Standard action”, “Out of range”, “No LoE”, “Adjacent enemy: OA risk”)*

**Interactions**

* Hover → template preview on map
* Click `Use` → enter Target mode; inline quick-pick for targets if needed
* Immediate powers also surface via the **Reactive Bar** when actually usable

**Empty State**

* Text: `No legal powers for current actions.`
* Button: `Show all` *(reveals disabled rows with reasons)*

---

### 4B) Status Drawer

**Conditions (chips grid)**

* **Chips:** `DZ` `STN` `IMM` `SLOW` `WKN` `PRN` `BLN` `INV` `RST` `MRK` `ONGO 5 fire` …
* **Chip info:**

  * Text: code or `ongo <n> <type>`
  * Subtext: `save ends` / `Eo <source> next` / `So <source> next`
  * Counter dot for save-ends
* **Chip action (GM):** `Remove`
* `Mark` chip tooltip: `by <actor>`

**Ongoing & Timers**

* Lines like: `Ongoing 5 fire (save ends)`
* Start-of-turn tick reminder if this is the active actor

**Movement Flags**

* Lines: `Speed 0` • `Speed ≤2` • `Cannot shift` *(only if active)*

**Quick Stats**

* Displays: `Speed` `Reach` `Senses` *(hidden if default values)*

---

## 5) Log Peek (compact)

* **Two latest lines** with icons, e.g.:

  * `🎲 A hits B: d20 13 + 8 = 21 vs AC 19 (hit)`
  * `💥 B takes 9 (fire). Temp 3 → 0, HP 22 → 19`
* **Button:** `Open Log`

---

## Complete Inventory (copy-paste list)

### Buttons

* **Reactive:** `Use` `Skip` `Details`
* **Header:** `Second Wind`
* **Action Strip:** `Standard` `Move` `Minor` `Shift` `Stand Up` `Sustain [Minor]` `Measure` `End Turn` `Override`
* **Powers:** `Use` `Show all`
* **Status (GM):** `Remove`

### Static Labels / Microcopy

* `HP` `Temp` `Surges` `AC` `Fort` `Ref` `Will`
* `bloodied` `dying` `dead`
* Drawer: `Powers` `Status`
* Power tabs: `At-Will` `Encounter` `Daily` `Utility`
* Filters: `Std` `Move` `Minor` `Free` `Immediate`
* Empty state: `No legal powers for current actions.`

### Tooltips (reasons & helpers)

* `Immediate already used this round`
* `No Standard action available`
* `Out of range`
* `No Line of Effect`
* `Ranged/Area in melee may provoke OA`
* `Encounter power expended`
* `Daily power expended`
* `Shift: move 1 without provoking`
* `Stand Up: spend Move to remove Prone`
* `Sustain: spend [Minor] to maintain effect`
* `Second Wind: spend a surge, +2 all defenses until your next turn`

### Displays

* `HP: 27/38` `Temp: 3` `Surges: 5`
* `AC 21  Fort 19  Ref 17  Will 18`
* Condition chips & ongoing list lines

---

## Visibility Rules (keep it minimal)

* **Reactive Bar:** only when a reactive window is open for *you*
* **Second Wind:** visible on your turn (or GM view); disabled if used
* **Stand Up:** visible only when **Prone**
* **Sustain:** visible only when you have a sustain effect unpaid this turn
* **Powers:** default filter shows only **legal** powers for remaining actions; `Show all` reveals disabled with reasons
* **Status Drawer:** show only **active** conditions/ongoings; hide empty sections

---

## Keyboard Hints (tiny text under Action Strip)

`M Move` `T Target` `G Measure` `1/2/3 Std/Move/Minor` `Q/E rotate blast` `Enter Commit` `Esc Cancel` `. End Turn`

---

## Rationale (why this fits 4e)

* **Action economy first:** slots always visible; swap rules implicit
* **Power cadence:** tabs and badges match At-Will/Encounter/Daily/Utility
* **Sustain & Immediate surfaced:** first-class, contextual actions—core to 4e play
* **Conditions/ongoing clarity:** chips show only mechanics that matter in combat
* **Reactive flow:** inline bar prevents modal churn and keeps turn context intact

---

*This sidebar remains small, deterministic, and perfectly tuned for D\&D 4e’s tactical cadence while avoiding feature creep or tab sprawl.*
