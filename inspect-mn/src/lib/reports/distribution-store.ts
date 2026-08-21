import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import {
  DEFAULT_REPORT_DISTRIBUTION_CONFIG,
  REPORT_DISTRIBUTION_CONFIG_KEY,
  normalizeReportDistributionConfig,
  type ReportDistributionConfig,
} from "@/lib/reports/distribution-config";

export async function readReportDistributionConfig(): Promise<ReportDistributionConfig> {
  if (!hasServiceRole()) return DEFAULT_REPORT_DISTRIBUTION_CONFIG;
  const { data, error } = await createAdminClient()
    .from("app_data_store")
    .select("payload")
    .eq("key", REPORT_DISTRIBUTION_CONFIG_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.payload
    ? normalizeReportDistributionConfig(data.payload)
    : DEFAULT_REPORT_DISTRIBUTION_CONFIG;
}

export async function writeReportDistributionConfig(raw: unknown) {
  if (!hasServiceRole()) throw new Error("SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
  const config = normalizeReportDistributionConfig({
    ...(raw && typeof raw === "object" ? raw : {}),
    updatedAt: new Date().toISOString(),
  });
  const { error } = await createAdminClient().from("app_data_store").upsert(
    {
      key: REPORT_DISTRIBUTION_CONFIG_KEY,
      payload: config,
      updated_at: config.updatedAt,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return config;
}

