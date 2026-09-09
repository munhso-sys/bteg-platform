# Local + production run model

Production portal (`bteg.inspect.mn`) embeds duty modules from sibling Vercel apps via iframe.
Local does the same against `localhost:3001–3003`.

Docs that claimed “all modules inside one Next.js app / no iframe” are **obsolete** relative to current `DutyModulePage` + `ModuleEmbed`.

## Local (parity with production architecture)

```powershell
# Repo root (any clone path)
.\scripts\start-duty-modules.ps1
cd inspect-mn
npm install
npm run dev
```

Open http://localhost:3000

See `HOW_TO_OPEN_DUTY_MODULES.md` and each app’s `.env.example`.

## Production redeploy

Do **not** redeploy from this doc. Production changes require explicit human instruction.