# Process Module (процесс төв)

PFD / BPMN-style process tree — Single Source of Truth linking policy, inspection, NC/RCA, risk, and employee voice via `process_id`.

## Local

```powershell
cd process
npm install
npm run dev
# http://localhost:3004/processes
```

Portal embed: set `NEXT_PUBLIC_PROCESS_URL=http://localhost:3004`, then open `/process` in inspect-mn.

```powershell
# repo root
node scripts\sync-local-env.cjs
.\scripts\start-duty-modules.ps1
cd inspect-mn
npm run dev
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/processes/tree` | Recursive L1→L4 tree + health |
| GET | `/api/v1/processes/:id/analytics` | Subtree aggregates |
| GET/POST | `/api/v1/processes` | List / create |
| GET/PUT | `/api/v1/processes/:id` | Read / update |

## Diagrams & documents

| Route | Purpose |
|-------|---------|
| `/documents` | Upload + view `.bpmn` / `.drawio` / `.pdf` / `.xlsx` / `.csv` |
| `POST /api/v1/processes/upload` | Multipart upload + Excel parse + versioning |
| `GET /api/v1/processes/:id/diagram` | Diagram meta / XML / binary |
| `POST /api/v1/processes/:id/dfd-map` | Map diagram node → DFD |
| `GET /api/v1/processes/:id/node-details/:nodeId` | DFD + matrix + RACI drawer |

```powershell
npm run import:samples   # load Desktop PFD copies from data/samples
```
