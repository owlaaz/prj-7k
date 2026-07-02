# Guild Boss Fight Planner — Build Specification

> A planning document for an AI coding assistant. It specifies a web application
> that computes the **minimum-round** plan for a 30-member guild to kill 4 bosses,
> where **each member has a different average damage per round against each boss**.
> Plans are **saved to a database with an auto-increment ID**, can be **shared**,
> **duplicated** into new editable plans, and **locked** (made read-only).

---

## 1. Overview & Goal

A guild must defeat **4 bosses**, each with **100,000,000 HP** (100M). The guild has up to
**30 members**. Each member may attack **up to 10 rounds** total and may split those rounds
across any bosses.

**Per-boss damage:** a member's average damage per round is **different for each boss**
(different battle styles). Input is a **matrix** `d[member][boss]`.

**Optimization objective (primary):** assign rounds so **every boss ≥ 100M cumulative
damage** using the **minimum total number of rounds**. Tie-breakers: (1) minimize overkill,
(2) fewer boss-switches per member.

**Persistence & collaboration:** each plan is **saved to a database** with a unique
**auto-increment ID**, so it can be **shared with friends via a URL**. A plan can be
**duplicated** into a new plan (same values, new ID) so another roster's numbers can be
edited without touching the original. A plan can be **locked** to prevent edits (read-only);
locked plans can still be viewed, shared, and **duplicated**.

**Deliverable — a web app with these pages:**
- **Plannings list (landing):** all saved plans; create / open / duplicate / lock / share / delete.
- **Input page:** name the plan + key in each member's damage per round **against each boss**.
- **Summary page:** the computed plan (per member, per boss, total rounds) + share/duplicate.

---

## 2. Assumptions & Configurable Parameters

| Parameter          | Default        | Notes                                             |
|--------------------|----------------|---------------------------------------------------|
| `NUM_BOSSES`       | 4              | Number of bosses / damage columns.                |
| `BOSS_HP`          | 100,000,000    | **Default** full HP; each boss's **remaining HP** is editable (mid-event recheck). |
| `MAX_MEMBERS`      | 30             | Members can be fewer; support add/remove rows.    |
| `MAX_ROUNDS_MEMBER`| 10             | **Default** rounds; each member's **remaining rounds** is editable (mid-event recheck). |

**Modeling assumptions:**
- A **round is atomic**: one round from member *i* vs boss *b* deals exactly `d[i][b]` to boss *b* only.
- Damage is a fixed average (deterministic); no RNG in v1.
- Different battle styles are modeled directly by the matrix `d[i][b]`.
- Overkill is allowed; each boss just needs total damage ≥ its **remaining HP**.
- **Mid-event re-planning ("recheck"):** the planner always works against **remaining HP** per
  boss and **remaining rounds** per member. At the start these equal `BOSS_HP` and
  `MAX_ROUNDS_MEMBER`; edit them partway through to re-optimize the rest of the fight.

---

## 3. Formal Problem Definition

**Given:** members `i = 1..N` with **remaining rounds** `R_i` (default 10, editable);
bosses `b = 1..M` with **remaining HP** `H_b` (default 100M, editable); damage matrix
`d[i][b] ≥ 0`. Fixing `R_i = 10` and `H_b = 100M` gives the start-of-event case; editing them
mid-event lets you **re-plan the remaining fight** ("recheck").

**Variables:** `x[i][b]` = rounds member *i* spends on boss *b* (non-negative integer).

**Constraints:**
- Member cap:  for each *i*,  `Σ_b x[i][b] ≤ R_i`   (R_i = that member's rounds still available)
- Boss kill:   for each *b* with `H_b > 0`,  `Σ_i x[i][b] · d[i][b] ≥ H_b`   (H_b = remaining HP)
  - Bosses already dead (`H_b = 0`) are dropped from the problem.

**Objective:** `minimize Σ_i Σ_b x[i][b]`  (tie-break: minimize overkill `Σ_b (Σ_i d[i][b]·x[i][b] − H_b)`).

This is a small **ILP** (120 integer variables, ~34 constraints) — solvable **exactly and
instantly**. With per-boss damage a naive greedy can be sub-optimal, so the ILP is the
recommended default (§6.3), with a greedy fallback (§6.4).

---

## 4. Data Model

### 4.1 Planning input model (`data` payload)
```json
{
  "config": { "numBosses": 4, "bossHp": 100000000, "maxRoundsPerMember": 10 },
  "bosses": [
    { "fullHp": 100000000, "hpRemaining": 60000000 },
    { "fullHp": 100000000, "hpRemaining": 100000000 },
    { "fullHp": 100000000, "hpRemaining": 0 },
    { "fullHp": 100000000, "hpRemaining": 100000000 }
  ],
  "members": [
    {
      "id": "m1", "name": "PlayerOne",
      "roundsRemaining": 6,
      "statsByBoss": [
        { "totalDamage": 180000000, "totalRounds": 10 },
        { "totalDamage": 96000000,  "totalRounds": 8  },
        { "totalDamage": 0,         "totalRounds": 0  },
        { "totalDamage": 150000000, "totalRounds": 10 }
      ],
      "damageByBoss": [18000000, 12000000, 0, 15000000]
    }
  ]
}
```
- **`damageByBoss[b]` is the avg damage per round vs boss `b` and is the canonical value used
  by the optimizer and stored in CSV.** All damage values are raw numbers internally
  (e.g. `18000000`); the UI shows/accepts them in **millions** (see §4.4 Units).
- **`bosses[b].hpRemaining`** is the boss's **current HP left** (editable mid-event). Defaults to
  `config.bossHp` (= `fullHp`) at the start of an event. `hpRemaining = 0` ⇒ boss already dead,
  excluded from planning. `bosses[b].fullHp` is kept for progress display (damage done =
  `fullHp − hpRemaining`) and "reset to full."
- **`member.roundsRemaining`** is that member's **rounds still available** (editable mid-event).
  Defaults to `config.maxRoundsPerMember` (10). `0` ⇒ member can't contribute this round of planning.
- **`statsByBoss[b]` is an optional web-only entry aid:** the season's `totalDamage` and
  `totalRounds` against boss `b`. When present, the app **derives** `damageByBoss[b] =
  totalDamage / totalRounds` (0 rounds ⇒ avg 0 / blank). When absent (e.g. after a CSV import
  that only carries averages), the user may type `damageByBoss[b]` directly.
- `0`/blank avg = ineffective (never assigned there). `id` unique & stable; `name` free text.

### 4.2 Plan output model (computed result)
```json
{
  "feasible": true, "totalRoundsUsed": 44, "lowerBoundRounds": 42,
  "solverUsed": "ilp", "optimal": true,
  "perBoss": [
    { "bossIndex": 1, "hp": 100000000, "damageDealt": 103000000, "overkill": 3000000, "roundsUsed": 6,
      "contributors": [ { "memberId": "m1", "name": "PlayerOne", "rounds": 5, "dmgPerRound": 18000000, "damage": 90000000 } ] }
  ],
  "perMember": [
    { "memberId": "m1", "name": "PlayerOne", "totalRoundsUsed": 6, "roundsRemaining": 4,
      "assignments": [ { "bossIndex": 1, "rounds": 5, "dmgPerRound": 18000000, "damage": 90000000 } ] }
  ],
  "warnings": []
}
```
If infeasible: `feasible=false` and `warnings` lists un-killable bosses + max reachable damage each.

### 4.3 Planning record (database entity)
```json
{
  "id": 42,                       // AUTO-INCREMENT primary key (shareable)
  "name": "Season 12 - Guild A",
  "locked": false,                // read-only flag
  "parentId": 41,                 // set when created via duplicate; null otherwise
  "data": { "config": {}, "members": [] },   // the §4.1 input model
  "result": { },                  // optional cached §4.2 output (may be null)
  "createdAt": "2026-07-02T10:00:00Z",
  "updatedAt": "2026-07-02T10:05:00Z"
}
```

### 4.4 Units — millions (`M`) for damage
All **damage** values (avg, total damage, boss HP, damage dealt, overkill) are presented and
entered in **millions with an `M` suffix**: `1M`, `0.5M`, `6M`, `0.2M`, `100M`. **Rounds are
plain integers** (a count, never in `M`).

- **Internal storage stays raw** (e.g. `18000000`) so the optimizer and totals are exact.
  Convert only at the UI and CSV boundary.
- **Formatter** `formatM(raw)`: `18000000 → "18M"`, `500000 → "0.5M"`, `6000000 → "6M"`,
  `200000 → "0.2M"`, `100000000 → "100M"`. Trim trailing zeros; keep enough decimals to be exact.
- **Parser** `parseM(str)`: a bare number is interpreted **in millions** (`"6" → 6000000`,
  `"0.5" → 500000`); an explicit `M`/`m` suffix is accepted and optional (`"6M" → 6000000`).
  Reject negatives and non-numeric input.

---

## 5. Persistence, Sharing, Duplicate & Lock

### 5.1 Database schema
**PostgreSQL** (recommended) — auto-increment via `BIGSERIAL`:
```sql
CREATE TABLE plannings (
  id          BIGSERIAL PRIMARY KEY,                 -- auto-increment, used in share URL
  name        TEXT        NOT NULL DEFAULT 'Untitled plan',
  locked      BOOLEAN     NOT NULL DEFAULT false,
  parent_id   BIGINT      NULL REFERENCES plannings(id) ON DELETE SET NULL,
  data        JSONB       NOT NULL,                   -- §4.1 input model
  result      JSONB       NULL,                       -- §4.2 cached output (optional)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
**SQLite** equivalent (for a simple local/self-host deploy): `id INTEGER PRIMARY KEY
AUTOINCREMENT`, `locked INTEGER NOT NULL DEFAULT 0`, JSON stored as `TEXT`.

### 5.2 REST API endpoints
| Method | Path                          | Purpose | Notes |
|--------|-------------------------------|---------|-------|
| GET    | `/api/plannings`              | List all plans | returns `id, name, locked, parentId, createdAt, updatedAt` (+ member/boss counts) |
| POST   | `/api/plannings`              | Create new plan | body `{ name?, data }` → `201 { record }` with new auto-increment `id` |
| GET    | `/api/plannings/:id`          | Fetch one plan | full record incl. `data` and `result`; `404` if missing |
| PUT    | `/api/plannings/:id`          | Update plan | body `{ name?, data }` → **`409 Conflict` if `locked`** |
| POST   | `/api/plannings/:id/duplicate`| **Duplicate** | copies `data`, `locked=false`, `parent_id=:id`, `name="Copy of …"`; **allowed even when source is locked**; returns new record |
| PATCH  | `/api/plannings/:id/lock`     | **Lock / unlock** | body `{ locked: true|false }` |
| DELETE | `/api/plannings/:id`          | Delete plan (optional) | `404` if missing |

- On any successful `PUT`, set `updated_at = now()`.
- The optimizer runs **client-side** (§6). After computing, the client may cache the result
  back via `PUT` (allowed only when unlocked). Result is derived from `data`, so a locked
  plan's result never needs to change.

### 5.3 Auto-increment IDs & sharing
- The DB assigns the ID; the client never sets it. The ID appears in the UI and the **share
  URL** `https://<host>/plan/:id` (opens the Summary; `/plan/:id/edit` opens the Input page).
- **Privacy note:** sequential IDs are guessable. If unlisted sharing is desired, add a
  random `share_token` column and route `/plan/t/:token`. (Optional; note it for the builder.)

### 5.4 Duplicate semantics
Creating a copy produces a brand-new plan with its **own auto-increment ID**, `locked=false`,
`parent_id` pointing at the source, `name = "Copy of {source.name}"` (or a user-supplied
name), and a **deep copy** of `data` (config + members + all per-boss damage values). The
user then edits member values for the new roster. **Duplicate works whether or not the source
is locked** — this is the intended way to iterate on a locked plan.

### 5.5 Lock / Unlock semantics
- `locked = true` → the Input page is **read-only**: all inputs and Save disabled, with a
  banner: *"This plan is locked (read-only). Duplicate it to make changes."*
- Editing is blocked **on the server** (`PUT` → `409`) so a stale client cannot bypass it.
- **Still allowed while locked:** view Summary, **Share**, and **Duplicate** (→ new unlocked plan).
- **Unlock** is provided (toggle back to editable). If you want locks to be permanent, remove
  the unlock action / restrict it to an owner — call this out as a config choice.

---

## 6. Algorithm

Implement the optimizer as a **pure module** (`planner.ts`) taking the §4.1 input and
returning the §4.2 output, independent of UI/DB and unit-tested.

### 6.1 Step 0 — Quick (necessary) feasibility check
For each boss `b`, `maxDmg_b = Σ_i d[i][b] · R_i`. If `maxDmg_b < H_b` for any boss →
**infeasible** (that boss can't die even if everyone focuses it). Necessary but not
sufficient (members are shared); the solver is the definitive check.

### 6.2 Step 1 — Lower bound on total rounds
Relax the shared cap: pretend each member has 10 rounds available for **every** boss. Then
per boss `b`, sort members by `d[i][b]` desc and take rounds (≤10 each) until cumulative ≥
`H_b`; call it `L_b`. Since relaxing constraints only lowers the optimum,
`lowerBoundRounds = Σ_b L_b` is a **valid lower bound**. Display it beside the result.

### 6.3 Step 2 (RECOMMENDED) — Exact optimum via ILP
Solve §3 exactly (tiny problem).
- **In-browser (preferred, no solver backend):** `glpk.js` (robust MIP) or
  `javascript-lp-solver` (mark all `x[i][b]` integer).
- **Optional backend:** OR-Tools CP-SAT / PuLP.

Two-phase objective: (1) minimize total rounds → `R*`; (2) add `Σ x[i][b] = R*` and minimize
overkill. Set `optimal=true`, `solverUsed="ilp"`. If solver infeasible → return infeasible
result with per-boss shortfalls.

### 6.4 Step 2 (FALLBACK) — Greedy heuristic
Use only if avoiding a solver dependency, or as a cross-check. **May be sub-optimal** with
per-boss damage (strong members get contested between bosses).
```
remaining[b] = H_b ;  capLeft[i] = R_i ;  assign = {}
while any remaining[b] > 0:
    best = argmax_{i,b} d[i][b]  s.t. capLeft[i]>0, remaining[b]>0, d[i][b]>0
    if best is None: record shortfall / infeasible; break
    (i*,b*) = best
    r = min(capLeft[i*], ceil(remaining[b*]/d[i*][b*]))
    assign[(i*,b*)] += r ;  remaining[b*] -= r*d[i*][b*] ;  capLeft[i*] -= r
# optional local search: move/swap rounds to a boss where the member hits harder,
# if it lowers total rounds while keeping every boss >= H_b.
```
Set `solverUsed="greedy"`, `optimal=false`; if it equals `lowerBoundRounds`, it is optimal.

### 6.5 Complexity
ILP: instant. Greedy: O(iter · N · M). Lower bound: O(N·M·log N).

### 6.6 Worked micro-example (unit test)
2 bosses, HP=100, cap=10. Matrix:

| Member | vs Boss1 | vs Boss2 |
|--------|----------|----------|
| A      | 60       | 10       |
| B      | 50       | 55       |
| C      | 10       | 50       |

- Lower bound: Boss1 60+50 in **2**; Boss2 55+50 in **2** ⇒ LB = **4**.
- Optimal: Boss1 = A×1 (60)+B×1 (50)=110 ✓; Boss2 = B×1 (55)+C×1 (50)=105 ✓; B uses 2 (≤10).
  **Total = 4 = lower bound ⇒ optimal.** Placement matters (B belongs on Boss2). Use as a regression test.

---

## 7. Web Application Specification

### 7.1 Recommended tech stack
- **Frontend:** React + Vite (TypeScript), Tailwind CSS, `react-router-dom`.
- **Backend:** Node + Express (or Fastify) + **Prisma** ORM. Or **Supabase** (hosted Postgres
  + auto REST/JS client) to minimize backend code — a good fit for "share with friends."
- **Database:** PostgreSQL (Supabase/Neon/Railway) or SQLite for simple self-host.
- **Optimizer:** `glpk.js` in-browser (client-side). No solver backend required.
- **State:** server (DB) is the source of truth; use `localStorage` only for unsaved drafts.
- **Charts (optional):** Recharts.

### 7.2 Navigation
Routes: `/` (Plannings list), `/plan/new` (new Input), `/plan/:id/edit` (Input, read-only if
locked), `/plan/:id` (Summary). Top nav links to the list and shows the current plan name + a
🔒 badge when locked.

### 7.3 Page — Plannings list (landing)
Table or cards of all saved plans:
- Columns: **ID**, **Name**, **Locked** (🔒 badge), members count, bosses count,
  **Updated at**, and (if duplicated) a clickable **"from #parentId"** tag linking to
  `/plan/:parentId` (hidden if the parent was deleted).
- Row actions: **Open** (→ Summary), **Edit** (→ Input), **Duplicate**, **Lock/Unlock**,
  **Copy Share Link**, **Delete** (confirm).
- Header button: **+ New Planning** (→ `/plan/new`).
- Empty state prompts creating the first plan.

### 7.4 Page — Input
- **Plan name** field at top; **Save** button (POST if new → gets auto-increment ID and routes
  to `/plan/:id/edit`; PUT if existing).
- **Back to Parent** link (top, breadcrumb style): if this plan has a `parentId` and the parent
  exists, show `← Parent #<parentId>` (or the parent's name) linking to `/plan/:parentId`. Lets
  you jump from a duplicate back to the plan it came from. Hidden for originals and when the
  parent was deleted.
- **Config panel** (collapsible): `numBosses`, `bossHp` default (shown as `100M`),
  `maxRoundsPerMember` default (10). Changing `numBosses` adds/removes boss columns.
- **Boss panel (mid-event recheck):** one row per boss showing **Full HP** and an editable
  **Remaining HP** field (in `M`), plus a progress bar (`fullHp − hpRemaining` done). Buttons:
  **Reset this boss to full**, **Reset all to full**. Set a boss's Remaining HP to `0` to mark it
  cleared (it drops out of planning). This is how you re-plan partway through an event.
- **Members matrix table** (up to 30 rows; add/remove/fewer allowed). Columns:
  `# | Name | Rounds Left | [Boss1 …] | [Boss2 …] | … | Remove`, where:
  - **Rounds Left** = that member's `roundsRemaining` (editable integer, default 10). Set lower as
    members spend attacks during the event; `0` means they're done and won't be assigned.
  - For **each member × each boss** the user enters the season's raw numbers and the app derives
    the average (unchanged from before):
    - Per boss cell, three fields: **Total Damage** (in `M`), **Total Rounds** (integer), and a
      read-only **Avg /round** (= Total Damage ÷ Total Rounds, shown in `M`, live-updated).
    - A compact **"Avg only"** toggle collapses each boss to the single editable Avg field (used
      when data came from CSV, which carries only averages — see §7.7).
    - The derived **Avg** is what feeds the optimizer and what is written to CSV.
  - Keyboard tab/enter navigation; spreadsheet paste (nice-to-have). Buttons: Add Member,
    Add 30 rows, Clear all, **Import CSV**, **Export CSV**. Imported rows load straight into
    this editable grid and remain fully editable on the web (full spec in §7.7).
- **Units:** all damage fields use `M` (millions) input/display per §4.4 (`6M`, `0.5M`, `0.2M`);
  Total Rounds and Rounds Left are plain integers.
- **Live totals bar:** members count; per boss `Σ avg[i][b]·roundsRemaining[i]` (shown in `M`)
  with green/red flag vs that boss's **Remaining HP**; optional guild totals.
- **Calculations exposed on the web:** per-cell `Avg = TotalDamage / TotalRounds`; per-member
  season totals; per-boss reachable damage **against remaining HP with remaining rounds**. All
  recompute live as the user types — so editing a Remaining HP or Rounds Left immediately updates
  feasibility flags before you even hit Compute.
- **Validation:** Total Damage `≥ 0` (in `M`); Total Rounds and Rounds Left integers `≥ 0`;
  Remaining HP `≥ 0` (in `M`, warn if `> fullHp`); **Total Rounds = 0 ⇒ Avg = 0/blank** (no
  divide-by-zero); all-zero-avg member flagged; duplicate-name warning (non-blocking).
- **Locked behavior:** if `locked`, all inputs/Save disabled with the read-only banner (§5.5).
  For a live recheck on a locked baseline, **Duplicate** first, then edit Remaining HP / Rounds
  Left on the copy. (Typical workflow: lock the season baseline, duplicate each time you recheck.)
- **Compute Plan** → runs `planner` client-side against remaining HP + remaining rounds →
  navigates to Summary (and may cache `result`).

### 7.5 Page — Summary
- **Headline cards:** **Total Rounds Used**; **Lower Bound** (+ **OPTIMAL ✓** when equal /
  proven); **All Bosses Killed?**; **Total Overkill**.
- **Per-Boss cards:** boss #, **Remaining HP targeted**, damage dealt, overkill, rounds used;
  fill bar (vs the boss's remaining HP, with overkill marker); contributor list
  `member — rounds × dmg/round = damage`. Bosses already cleared (`hpRemaining = 0`) show a
  **"Cleared"** badge and need no rounds.
- **Per-Member table:** `Member | Rounds Left (input) | Assignments (e.g. "Boss 2 ×4, Boss 4 ×2")
  | Rounds Used | Rounds Still Free | Total Damage`; sortable, searchable.
- **Actions:** **Copy Share Link**, **Duplicate**, **Edit** (disabled/hidden if locked),
  **Lock/Unlock**, **Back to Parent**, Export CSV / print, Recompute, Back to list.
  - **Back to Parent** → navigates to `/plan/:parentId`. Shown **only** when `parentId` is set
    and the parent still exists (label: `← Parent #41` or the parent's name if resolved).
    Hidden for original (non-duplicated) plans and when the parent was deleted (`parentId` null).
- **Infeasible state:** banner listing un-killable bosses, max reachable damage, and shortfall.
- **Units:** all damage figures on this page display in `M` (millions) per §4.4; rounds are integers.

### 7.6 Suggested file structure
```
client/
  src/
    planner/   planner.ts  ilp.ts  planner.test.ts  types.ts
    api/       plannings.ts            # fetch wrappers for §5.2 endpoints
    store/     useGuildStore.ts        # current plan + draft cache
    pages/     PlanningsListPage.tsx  InputPage.tsx  SummaryPage.tsx
    components/ ConfigPanel.tsx MembersMatrixTable.tsx FeasibilityBar.tsx
               BossCard.tsx MemberPlanTable.tsx StatCard.tsx LockBadge.tsx
    lib/       csv.ts  format.ts
    App.tsx  main.tsx
server/          # (omit if using Supabase directly from the client)
  src/routes/plannings.ts     # §5.2 endpoints, enforce lock on PUT (409)
  src/db/ (prisma schema + migrations for §5.1)
  src/index.ts
```

### 7.7 CSV Import / Export

**File format.** The CSV stores the **avg damage per round per boss** (one value per boss) —
**not** the Total Damage / Total Rounds, which are web-only entry aids (§7.4). Header row + one
row per member; columns follow `numBosses`: `name,boss1,boss2,boss3,boss4`. Values use the `M`
convention (§4.4). Example:
```
name,boss1,boss2,boss3,boss4
PlayerOne,18M,12M,9M,15M
PlayerTwo,7M,20M,0.5M,11M
```
- Values are averages in millions (`18M`, `0.5M`, `0.2M`). The parser also accepts a bare number
  (interpreted in millions) and raw integers with an explicit unit — but export always writes the
  `M` form for consistency. Blank cell = `0`. Column count must match `numBosses` (or be mapped
  by header — see below).
- On **import**, since the CSV carries only averages, rows load with `damageByBoss` set directly
  and `statsByBoss` (totals) left empty; those cells display in the Input grid's **"Avg only"**
  mode and remain editable. The user can switch a cell back to Total Damage + Rounds entry at any
  time to recompute the avg.

**Export.** An **Export CSV** button on the Input page writes the current **averages** to a
downloadable `.csv` in the `M` form above. Filename suggestion: `plan-<id>-<name>.csv`.
Export reflects whatever is currently in the grid (including unsaved edits).

**Import — and stays editable (key requirement).** An **Import CSV** button reads a file and
**loads the values into the editable matrix grid**. Imported rows are *not* read-only or a
separate view — they populate the same inline inputs, so the user can **continue editing every
value on the web** afterward, then Save to DB and Compute as normal. Import is purely a fast
way to fill the form.

Import behavior:
1. **Parse** with a tolerant CSV parser (e.g. PapaParse). Detect and skip the header if present
   (match on `name`/`boss` column names); if headers are present, **map columns by header name**
   so column order and extra/missing columns are handled gracefully. If no header, map by
   position against `numBosses`.
2. **Import mode** (offer a small dialog before applying):
   - **Replace** (default): clear the current roster and load the file's rows.
   - **Merge by name**: for each CSV row, if a member with the same `name` exists, **update its
     damage values in place**; otherwise **append** a new row. This lets the user re-import a
     corrected sheet without losing manual web edits to other members.
3. **Validate per cell:** each damage must be numeric `≥ 0`; blank→0. Invalid cells are loaded
   as-is and flagged inline (red) so the user can fix them on the web — **import never silently
   drops data and never crashes**. Show a summary toast: `Imported N members (M cells need
   attention)`.
4. **Respect caps:** if a CSV has more than `MAX_MEMBERS` rows, import up to the cap and warn
   about the remainder. If it has more/fewer damage columns than `numBosses`, warn and either
   pad with `0` or ignore extras (matching by header when possible).
5. **Marks the plan dirty:** after import the plan has unsaved changes; Save persists it (POST
   for a new plan → gets the auto-increment id; PUT for an existing one).

**Interaction with Lock.** Import (like any edit) is **disabled when the plan is `locked`**;
the buttons are greyed with the read-only banner (§5.5). **Export is always available**, locked
or not. To import into a locked plan, **Duplicate first** (§5.4), then import into the copy.

---

## 8. Edge Cases & Error Handling

| Case | Expected behavior |
|------|-------------------|
| Boss `b` with `Σ_i d[i][b]·10 < 100M` | Infeasible for that boss; report shortfall. |
| All-zero member | Allowed; flagged; never assigned. |
| **Boss Remaining HP = 0** | Boss is cleared; dropped from planning; shown "Cleared", 0 rounds. |
| **Member Rounds Left = 0** | Member excluded from this plan (no rounds to give). |
| **Remaining HP > Full HP** | Allowed but warn (unusual); planner still targets Remaining HP. |
| **All members' Rounds Left too low to finish remaining HP** | Infeasible; report which bosses can't be finished with rounds left + shortfall. |
| **Total Rounds = 0 for a boss** | Avg = 0 / blank (no divide-by-zero); member not assigned there unless avg entered directly. |
| **Damage entered as `M`** (`6M`, `0.5M`, bare `0.2`) | Parsed to raw (§4.4); rounds stay integers; reject negatives/non-numeric. |
| Member contested across bosses | ILP resolves optimally; greedy may not — prefer ILP. |
| `d[i][b] ≥ 100M` | One round kills that boss; don't waste extra rounds there. |
| Blank / negative / non-numeric cell | Blank→0; reject negatives/non-numeric with inline error. |
| **Edit attempt on a locked plan** | Client disables inputs; server `PUT` returns **409**; show toast. |
| **Duplicate of a locked plan** | Allowed → new **unlocked** plan with new auto-increment ID. |
| Concurrent edits | Last-write-wins; optionally compare `updatedAt` and `409` on stale write. |
| Open/share a deleted or missing ID | `404` → friendly "plan not found" page. |
| Ties in damage | Deterministic tie-break (by member id) for reproducible plans. |
| CSV header missing / reordered / extra columns | Map by header when present, else by position; pad/ignore with a warning; never crash. |
| CSV cell blank / non-numeric / negative | Blank→0; load bad cells flagged (red) so they're fixable on the web; toast summarizes. |
| CSV has more rows than `MAX_MEMBERS` | Import up to the cap; warn about the remainder. |
| **Import while plan is locked** | Import disabled (read-only banner); prompt to Duplicate first. Export stays available. |

**Final assertion (must-have):** after building a result, assert every boss ≥ its HP and no
member exceeds its cap; else surface a warning rather than ship a wrong plan.

---

## 9. Acceptance Criteria

1. Input page enters/edits up to 30 members. Per member × boss the user enters **Total Damage**
   and **Total Rounds**, and the app computes **Avg = Total Damage ÷ Total Rounds** live (0
   rounds ⇒ 0). All damage fields use **`M` (millions)** input/display (`6M`, `0.5M`, `0.2M`);
   rounds are integers.
2. **Mid-event recheck:** each boss's **Remaining HP** and each member's **Rounds Left** are
   editable (defaults 100M / 10). Editing them and recomputing re-plans only the remaining fight;
   bosses at 0 HP are excluded, members at 0 rounds are excluded, and feasibility flags update live.
3. **CSV export** downloads the current **averages** (one per boss, in `M`); **CSV import**
   loads those averages **into the editable grid** ("Avg only" mode) so every value can still be
   edited on the web afterward, then Saved/Computed. Supports Replace and Merge-by-name modes,
   validates cells (flagging bad ones instead of crashing), and round-trips: export → re-import
   reproduces the same averages. Import is disabled when locked.
4. **Save** persists a plan and the **DB assigns an auto-increment ID**, shown in the UI and
   usable in a **share URL** that a friend can open.
5. **Plannings list** shows all saved plans with lock badges and actions.
6. **Duplicate** creates a new plan with a new ID (unlocked, `parentId` set, "Copy of …"),
   deep-copying all values — **and works on locked plans**. The duplicate shows a **Back to
   Parent** link (Input + Summary + list tag) that navigates to `/plan/:parentId`; it's hidden
   for originals and when the parent was deleted.
7. **Lock** makes a plan read-only, enforced on the server (edit `PUT` → 409); locked plans
   can still be viewed, shared, and duplicated. **Unlock** re-enables editing.
8. **Compute Plan** yields a plan where **every non-cleared boss ≥ its Remaining HP** and **no
   member exceeds its Rounds Left**; on §6.6 and §10 it reports `optimal=true` or
   `totalRoundsUsed == lowerBoundRounds`.
9. Summary shows per-boss and per-member breakdowns, total rounds, overkill, feasibility.
10. Infeasible rosters give a clear, non-crashing explanation with per-boss shortfalls.
11. `planner` unit tests pass: §6.6 example, infeasible case, single-huge-member, contention
   case, near-boundary capacity, **and a mid-event recheck case (reduced Remaining HP + reduced
   Rounds Left, with one boss already cleared)**. API tests: create returns incrementing id;
   PUT on locked → 409; duplicate of locked → new unlocked id.

---

## 10. Sample Dataset (for testing)

4 bosses × 100M, 10 rounds/member, 30 members. Member `k` (1..30) has base strength `base_k`
and per-boss factors so damage differs by boss:
- `base_k` (in `M`): `19,18,17,16,15,14,13,12,12,11,11,10,10,9,9,8,8,7,7,6,6,5,5,4,4,3,3,2,2,1`.
- Factors: Boss1 ×1.0, Boss2 ×0.7, Boss3 ×1.2, Boss4 ×0.9.
- `avg[k][b] = round(base_k × factor_b) M` (this is the avg/round; e.g. member 1 vs Boss1 = `19M`).
- To also exercise the totals→avg calc: for any cell, set `TotalRounds = 10` and
  `TotalDamage = avg[k][b] × 10` (e.g. member 1 Boss1: `190M` over `10` rounds ⇒ `19M` avg).

Verify the app: passes §6.1 per-boss feasibility, reports a small total round count with
`optimal=true`, and places members where their factor makes them strongest.

---

## 11. Stretch Features (out of v1 scope)

- **Unlisted share tokens** (random, non-guessable) instead of raw IDs (§5.3).
- **Owner accounts / auth** so only the owner can edit/lock/delete.
- **Version history / lineage view** using `parent_id`.
- Per-member custom round caps; fairness mode; RNG mode (mean+stddev per `d[i][b]`).
- Multi-plan compare (side-by-side total rounds); spreadsheet paste into the matrix.

---

### Quick summary for the coding AI
Build a **React + Vite + Tailwind** frontend with a small **Node/Express + Prisma + Postgres**
backend (or **Supabase**). Plans live in a `plannings` table with an **auto-increment `id`**
(§5.1) exposed via REST (§5.2) and a **share URL** `/plan/:id`. Support **Duplicate** (clone to
a new unlocked id, works on locked plans) and **Lock/Unlock** (read-only, edits blocked
server-side with 409; duplicate & share still allowed). Input is a **per-boss matrix** where the
user enters **Total Damage + Total Rounds** per member×boss and the app derives **Avg = damage /
rounds**; all damage is shown/entered in **millions (`M`)** (§4.4), rounds are integers, and
values are stored raw internally. CSV stores the **averages only** (in `M`) and imports back into
the editable grid. Each boss's **Remaining HP** and each member's **Rounds Left** are editable
(defaults 100M / 10) so the plan can be **re-checked mid-event** — the planner always targets
remaining HP with remaining rounds, dropping cleared bosses and spent members. The pure
`planner.ts` solves the §3 **ILP exactly** (glpk.js, client-side) to minimize total rounds with
every live boss ≥ its remaining HP and each member ≤ its rounds left, with a greedy fallback
(§6.4) and a lower bound (§6.2). Pages: Plannings list, Input (matrix, read-only when locked), Summary
(per-boss + per-member plan, share, duplicate). Ship tests in §9.
