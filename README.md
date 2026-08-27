# LifeSim

Interactive decision simulation for goals, constraints, resources, people, and deadlines.

## Stack

- React + TypeScript + Vite
- Local in-memory state (no backend)
- Custom simulation engine (no LLM / WebMCP yet)

## Scripts

```bash
npm install
npm run dev
npm run build
```

## App structure

- `src/pages` — Dashboard, Scenario Builder, Simulation Workspace
- `src/simulation/engine.ts` — deterministic simulation calculations & decisions
- `src/simulation/actions.ts` — stable action surface for future WebMCP tools
- `src/types` — shared domain types
- `src/data` — mock scenarios
- `src/hooks/useLifeSimApp.ts` — app state & navigation

## Simulation flow

1. Select a decision → `previewDecision()` computes consequences without mutating state
2. Review Impact Analysis + Before/After metrics
3. **Apply Decision** → `applyDecision()` mutates `SimulationState` and appends events
