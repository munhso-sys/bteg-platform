# Stable run mode

Production runs as **one Next.js app** on Vercel:

https://platform-portal-blue.vercel.app

## Why this is the stable mode

- No iframe to localhost sibling apps
- No 3 extra `next dev` processes / port conflicts
- All 9 modules live inside `inspect-mn`
- Supabase env only (URL + anon/publishable keys)

Sibling folders (`inspection-center`, `bgs-policy-compliance`, `development`) remain for deep feature work later; they are **not required** to run the portal.

## Local

```powershell
cd C:\Users\Owner\platform\inspect-mn
npm install
npm run dev
```

Open http://localhost:3000

## Production redeploy

```powershell
cd C:\Users\Owner\platform\inspect-mn
npx vercel --prod --yes
```
