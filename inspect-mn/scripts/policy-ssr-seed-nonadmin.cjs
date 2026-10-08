/**
 * LOCAL ONLY: non-admin Policy SSR fixture with position fields.
 * Does not print secrets/passwords.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const portalPath = path.join(__dirname, "..", ".env.local");

function parseEnv(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

const env = parseEnv(portalPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url?.includes("127.0.0.1") && !url?.includes("localhost")) {
  console.error("Refusing seed: Supabase URL is not local");
  process.exit(1);
}

const email = "policy.ssr.nonadmin@example.local";
const password = "Policy-Ssr-Local-Only-ChangeMe!";
const adminEmail = "policy.ssr.admin@example.local";
const adminPassword = "Policy-Ssr-Admin-Local-Only!";

async function ensureUser(emailAddr, passwordValue, fullName) {
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: emailAddr,
      password: passwordValue,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  const createBody = await createRes.json();
  let userId = createBody?.id || createBody?.user?.id;
  if (!createRes.ok) {
    const listRes = await fetch(
      `${url}/auth/v1/admin/users?page=1&per_page=200`,
      {
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
        },
      },
    );
    const listBody = await listRes.json();
    const found = (listBody?.users || []).find((u) => u.email === emailAddr);
    if (!found) {
      console.error("Auth user create/lookup failed", emailAddr, createRes.status);
      process.exit(1);
    }
    userId = found.id;
  }
  return userId;
}

async function main() {
  const nonAdminId = await ensureUser(email, password, "Policy SSR NonAdmin");
  const adminId = await ensureUser(adminEmail, adminPassword, "Policy SSR Admin");

  // Use specialist: has module.policy.view, NOT module.policy.edit (unlike dxsh_specialist locally).
  const sql = `
DELETE FROM public.temporary_edit_grants WHERE user_id IN ('${nonAdminId}', '${adminId}');

INSERT INTO public.user_profiles (
  user_id, email, full_name, phone, heltes_id, heltes_name, alba_id, alba_name,
  position_id, position_name, role_id, status
) VALUES
(
  '${nonAdminId}',
  '${email}',
  'Policy SSR NonAdmin',
  '00000001',
  'H-LOCAL',
  'Local Heltes',
  'A-LOCAL',
  'Local Alba',
  'P-LOCAL-SSR',
  'SSR Fixture Position',
  'specialist',
  'active'
),
(
  '${adminId}',
  '${adminEmail}',
  'Policy SSR Admin',
  '00000002',
  NULL, NULL, NULL, NULL,
  NULL, NULL,
  'admin',
  'active'
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  heltes_id = EXCLUDED.heltes_id,
  heltes_name = EXCLUDED.heltes_name,
  alba_id = EXCLUDED.alba_id,
  alba_name = EXCLUDED.alba_name,
  position_id = EXCLUDED.position_id,
  position_name = EXCLUDED.position_name,
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = now();
`;

  execSync(
    "docker exec -i supabase_db_inspect-mn psql -U postgres -d postgres -v ON_ERROR_STOP=1",
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );

  async function login(e, p) {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, password: p }),
    });
    return res.ok;
  }

  const out = {
    nonAdmin: { email, loginOk: await login(email, password), role: "specialist", hasPosition: true },
    admin: { email: adminEmail, loginOk: await login(adminEmail, adminPassword), role: "admin", hasPosition: false },
    urlHost: new URL(url).host,
  };
  fs.writeFileSync(
    path.join(__dirname, ".policy-ssr-local.fixture.json"),
    JSON.stringify(
      {
        nonAdmin: { email, password },
        admin: { email: adminEmail, password: adminPassword },
        note: "LOCAL ONLY — do not commit",
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
