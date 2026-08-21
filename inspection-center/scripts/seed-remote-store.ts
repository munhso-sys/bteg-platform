import { readFileSync, existsSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dataDir = path.join(process.cwd(), "data");

  async function upsert(keyName: string, fileName: string) {
    const file = path.join(dataDir, fileName);
    if (!existsSync(file)) {
      console.log(`skip ${keyName}: ${fileName} missing`);
      return;
    }
    const payload = JSON.parse(readFileSync(file, "utf8"));
    const { error } = await client.from("app_data_store").upsert(
      {
        key: keyName,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw error;
    console.log(`upserted ${keyName}`);
  }

  await upsert("inspection_center_store", "store.json");
  await upsert("inspection_center_annual_plans", "annual-plans.json");
  await upsert("inspection_center_annual_plan_types", "annual-plan-by-type.json");
  await upsert("inspection_center_master", "imported-master-sheets.json");
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
