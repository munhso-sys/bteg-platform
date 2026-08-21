# Platform workspace

Root: `C:\Users\Owner\platform`

## Folder map (ҮҮРЭГ / ҮР ДҮН / TOOLS)

| Path | Module | Role |
|------|--------|------|
| `inspection-center` | Хяналт шалгалт | ҮҮРЭГ — canonical app folder |
| `bgs-policy-compliance` | Журмын биелэлт | ҮҮРЭГ |
| `development` | Судалгаа хөгжүүлэлт | ҮҮРЭГ |
| `inspect-mn` | Platform portal | ҮР ДҮН + TOOLS + embeds ҮҮРЭГ apps |

Old path stub: `C:\Users\Owner\bgs-policy-compliance\MOVED.md`

## Quick start (portal)

```bash
cd C:\Users\Owner\platform\inspect-mn
npm install
npm run dev
```

See `inspect-mn/README.md` and `HOW_TO_OPEN_DUTY_MODULES.md` for ports and embed setup.

## Deployment readiness

- Env templates: `inspect-mn/.env.local.example`
- Supabase: document per-app; do not create production projects until IDs confirmed
- Vercel: prepare projects, do **not** deploy until credentials confirmed
