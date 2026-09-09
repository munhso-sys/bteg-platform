# Platform workspace

Clone root: this repository (example: `C:\Users\YOGA\platform-clean`).

## Folder map (ҮҮРЭГ / ҮР ДҮН / TOOLS)

| Path | Module | Role |
|------|--------|------|
| `inspection-center` | Хяналт шалгалт | ҮҮРЭГ — canonical app folder |
| `bgs-policy-compliance` | Журмын биелэлт | ҮҮРЭГ |
| `development` | Судалгаа хөгжүүлэлт | ҮҮРЭГ |
| `inspect-mn` | Platform portal | ҮР ДҮН + TOOLS + embeds ҮҮРЭГ apps |

## Quick start (local — matches production iframe architecture)

```powershell
.\scripts\start-duty-modules.ps1
cd inspect-mn
npm install
npm run dev
```

Open http://localhost:3000. See `HOW_TO_OPEN_DUTY_MODULES.md` and each app’s `.env.example`.

## Deployment readiness

- Env templates: `inspect-mn/.env.example`, `inspection-center/.env.example`, `bgs-policy-compliance/.env.example`, `development/.env.example`
- Supabase: document per-app; do not create production projects until IDs confirmed
- Vercel: do **not** deploy unless explicitly instructed
