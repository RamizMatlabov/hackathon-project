# LifeSim

Interactive decision simulation for goals, constraints, resources, people, and deadlines.

## Stack

- React + TypeScript + Vite
- Local in-memory state (no backend)
- Custom simulation engine
- WebMCP tool layer for AI agent integration (`document.modelContext`)

## Scripts

```bash
npm install
npm run dev
npm run build
```

## App structure

- `src/pages` — Dashboard, Scenario Builder, Simulation Workspace
- `src/simulation/engine.ts` — deterministic simulation calculations & decisions
- `src/simulation/actions.ts` — stable action surface (source of truth for tools)
- `src/webmcp/` — thin WebMCP adapter around `actions.ts`
- `src/types` — shared domain types
- `src/data` — mock scenarios
- `src/hooks/useLifeSimApp.ts` — app state & navigation

## Simulation flow

1. Select a decision → `previewDecision()` computes consequences without mutating state
2. Review Impact Analysis + Before/After metrics
3. **Apply Decision** → `applyDecision()` mutates `SimulationState` and appends events

## WebMCP (Phase 4)

LifeSim exposes structured tools through the [WebMCP](https://webmachinelearning.github.io/webmcp/) browser API on `document.modelContext`. Tools are a thin adapter over `src/simulation/actions.ts` — simulation logic stays in the engine/action layer.

**LifeSim works fully without WebMCP.** When the API is unavailable, the simulation and UI behave normally; only the agent integration is disabled.

### Required browser (official)

Per [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp) and the [WebMCP specification](https://webmachinelearning.github.io/webmcp/):

| Requirement | Details |
| --- | --- |
| Browser | **Chromium-based** (Google Chrome or Microsoft Edge) |
| Version | **Chromium 146.0.7672.0 or newer** recommended for local testing |
| Experimental flag | Enable **`chrome://flags/#enable-webmcp-testing`** (Chrome) or **`edge://flags/#enable-webmcp-testing`** (Edge) |
| Restart | **Fully quit and relaunch the browser** after changing the flag — a tab refresh is not enough |
| Origin isolation | WebMCP requires an [origin-isolated](https://developer.chrome.com/docs/web-platform/origin-isolation) document |
| Permissions policy | Top-level pages allow tools by default (`tools` policy defaults to `self`) |

WebMCP is **not** inferred from the user agent. LifeSim uses feature detection:

1. `document.modelContext` exists
2. `document.modelContext.registerTool` is callable
3. Each tool registration succeeds
4. `document.modelContext.getTools()` confirms registered tools (when available)

### Step-by-step local setup

#### 1. Install dependencies

```bash
npm install
```

#### 2. Enable the WebMCP testing flag

1. Open Chrome or Edge
2. Navigate to `chrome://flags/#enable-webmcp-testing` (or `edge://flags/#enable-webmcp-testing`)
3. Set **WebMCP testing** to **Enabled**
4. Click **Relaunch** (or quit the browser completely and open it again)

#### 3. Start the Vite dev server

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

#### 4. Open a scenario

1. From the dashboard, open an existing scenario or create a new one
2. Enter the Simulation Workspace
3. Mutation tools require an active simulation; observe/analyze tools return a clear error on the dashboard

#### 5. Verify WebMCP is active

Check the **WebMCP · Ready** indicator (bottom-right):

- **Ready** — all tools registered and verified
- **Unsupported** — `document.modelContext` is not exposed (flag off, wrong browser, or origin not isolated)
- **Registration Error** — API present but one or more tools failed to register

In development, open **WebMCP Debug** (bottom-left):

1. Review **WebMCP diagnostics** (`document.modelContext`, `registerTool`, registered tool count)
2. Click **Run WebMCP self-test** for a per-tool pass/fail report
3. Confirm `12 / 12 tools ready` when everything works

#### 6. Test with the Chrome Model Context Tool Inspector

1. Install the [Model Context Tool Inspector](https://developer.chrome.com/docs/ai/webmcp) extension (linked from official Chrome docs)
2. Open LifeSim with WebMCP **Ready**
3. Use natural-language prompts to invoke tools such as `get_simulation_state` or `preview_decision`
4. Confirm structured JSON responses in the extension and in the in-app debug log

### Origin isolation troubleshooting

If the flag is enabled but LifeSim still reports **Unsupported**, the page may not be origin-isolated. Optional Vite dev headers:

```ts
// vite.config.ts
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

Strict COEP can break cross-origin assets (e.g. Google Fonts). Self-host fonts or adjust CORP headers if needed.

### Status states

| State | Meaning |
| --- | --- |
| Unsupported | `document.modelContext` or `registerTool` is not available |
| Available | API detected; registration has not completed yet |
| Registering | Tools are being registered |
| Ready | All expected tools registered (verified via `getTools` when available) |
| Registration Error | One or more tools failed; see debug panel for the exact error |

### Safety model

- **Observe / Analyze** tools use `readOnlyHint: true` and never mutate live state
- **Act** tools mutate the simulation, update the UI, and prepend an **Agent action** entry to the activity log
- Agents should call `preview_decision` or `compare_scenario_branch` for “what if” questions before `apply_decision` or other mutations

### Implemented WebMCP tools

| Tool | Category | Mutates? | Description |
| --- | --- | --- | --- |
| `get_simulation_state` | Observe | No | Full current scenario snapshot |
| `get_available_decisions` | Observe | No | Structured list of allowed decisions |
| `preview_decision` | Analyze | No | Dry-run a decision with consequences |
| `compare_scenario_branch` | Analyze | No | Compare current plan vs decision branch |
| `simulate` | Analyze | No | Recalculate metrics on a clone |
| `apply_decision` | Act | Yes | Commit a decision to live state |
| `advance_day` | Act | Yes | Move simulation forward one day |
| `change_deadline` | Act | Yes | Set total deadline days |
| `add_task` | Act | Yes | Add a task |
| `remove_task` | Act | Yes | Remove a task by ID |
| `add_resource` | Act | Yes | Add a resource pool |
| `add_team_member` | Act | Yes | Add a team member |

All tools return JSON-serializable `{ success, data }` or `{ success: false, error, code }` results and handle missing simulation state without crashing the app.
