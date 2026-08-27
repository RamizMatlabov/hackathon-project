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
- `src/simulation/engine.ts` — decision consequence logic
- `src/types` — shared domain types
- `src/data` — mock scenarios
- `src/hooks/useLifeSimApp.ts` — app state & navigation
