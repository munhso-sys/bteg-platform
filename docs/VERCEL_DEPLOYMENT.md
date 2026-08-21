# Platform modules (real apps)

Portal: https://platform-portal-blue.vercel.app

| Menu | App folder | Production URL |
|------|------------|----------------|
| Хяналт шалгалт | `inspection-center` | https://platform-inspection-center.vercel.app |
| Журмын биелэлт | `bgs-policy-compliance` | https://platform-policy-compliance.vercel.app |
| Судалгаа хөгжүүлэлт | `development` | https://platform-development-amber.vercel.app |

Portal routes `/inspection`, `/policy-compliance`, `/development` embed these apps.

Redeploy a module:

```powershell
cd C:\Users\Owner\platform\inspection-center
npx vercel --prod --yes
```
