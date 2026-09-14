# Platform modules (real apps)

Portal: https://platform-portal-blue.vercel.app

| Menu | App folder | Production URL |
|------|------------|----------------|
| Хяналт шалгалт | `inspection-center` | https://platform-inspection-center.vercel.app |
| Журмын биелэлт | `bgs-policy-compliance` | https://platform-policy-compliance.vercel.app |
| Процесс | `process` | https://platform-process.vercel.app |

Portal routes `/inspection`, `/policy-compliance`, `/development`, `/process` embed these apps.

Redeploy a module:

```powershell
cd C:\Users\Owner\platform\inspection-center
npx vercel --prod --yes
```
