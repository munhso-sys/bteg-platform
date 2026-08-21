# Supabase (platform)

## Portal project (bteg.inspect.mn)

- Name: `inspect-bteg`
- Ref: `umswlpkjiwjohkolsyct`
- URL: `https://umswlpkjiwjohkolsyct.supabase.co`
- Region: `ap-southeast-2`
- Org: corporation0214-hue / separate from barulas shared apps

Env (local + Vercel `platform-portal`):
- `inspect-mn/.env.local`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://bteg.inspect.mn`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for access-request approve + invite)

### RBAC / access requests

Tables on `inspect-bteg`: `roles`, `permissions`, `role_permissions`, `user_profiles`, `access_requests`, `temporary_edit_grants`.

- Public form: `/access-request` (linked from `/login`)
- Admin: `/settings/access-requests`, `/settings/users`, `/settings/temp-grants`
- First logged-in user becomes Admin if no admin profile exists yet (bootstrap)

Default staff permission: `module.policy.view`. Unit managers / senior specialists: unit findings view. Edit rights via time-limited grants by DXSH.

### Auth URL config

Dashboard → [URL Configuration](https://supabase.com/dashboard/project/umswlpkjiwjohkolsyct/auth/url-configuration):

- **Site URL:** `https://bteg.inspect.mn`
- **Redirect URLs:**
  - `https://bteg.inspect.mn/auth/callback`
  - `https://bteg.inspect.mn/update-password`
  - `https://bteg.inspect.mn/**`
  - `https://platform-portal-blue.vercel.app/**`
  - `http://localhost:3000/**`

Create users under Authentication → Users for portal login.

### Custom SMTP (production email)

Built-in Supabase SMTP = **2 emails/hour** (not for production), independent of Pro plan.

Recommended: [Resend SMTP](https://resend.com/docs/send-with-supabase-smtp)

1. Create Resend account → add & verify domain (e.g. `inspect.mn`)
2. Resend → API Keys → create key (`re_...`)
3. Supabase project `inspect-bteg` → Authentication → [SMTP](https://supabase.com/dashboard/project/umswlpkjiwjohkolsyct/auth/smtp):
   - Enable Custom SMTP
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (STARTTLS)
   - User: `resend`
   - Password: Resend API key
   - Sender email: e.g. `noreply@inspect.mn` (must be on verified domain)
   - Sender name: `INSPECT-MN`
4. Authentication → [Rate Limits](https://supabase.com/dashboard/project/umswlpkjiwjohkolsyct/auth/rate-limits): raise email send limit (e.g. 100–200/h)
5. Test: `/forgot-password` on `https://bteg.inspect.mn`

Also confirm Auth URL Configuration Site URL = `https://bteg.inspect.mn`.

## Legacy / other apps (unchanged)

- Name: `bteg-smartmine-mvp` (`hlidcdaaxmdhisdfkaca`) — used by other apps / `platform.barulas.mn`
- Name: `bmce-dispatch` (`kzexcmnybyckgigkewxq`)

## Verify

1. Portal `/settings` → Supabase холболт **Холбогдсон**, ref `umswlpkjiwjohkolsyct`
2. Or: `GET /api/supabase/health`
3. Login + password reset must open `bteg.inspect.mn`, not `platform.barulas.mn`
