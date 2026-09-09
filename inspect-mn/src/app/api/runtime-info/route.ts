import { NextResponse } from "next/server";
import { getSupabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

function maskProjectRef(ref: string | null) {
  if (!ref) return null;
  if (ref.length <= 8) return `${ref.slice(0, 2)}ΓÇª`;
  return `${ref.slice(0, 4)}ΓÇª${ref.slice(-4)}`;
}

function maskSha(sha: string | null) {
  if (!sha) return null;
  if (sha.length <= 12) return sha;
  return `${sha.slice(0, 7)}ΓÇª`;
}

/**
 * Safe runtime fingerprint for Preview/Production parity checks.
 * Never includes secrets, tokens, emails, or store payloads.
 */
export async function GET() {
  const url = getSupabaseUrl();
  const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;

  return NextResponse.json({
    ok: true,
    app: "inspect-mn",
    version: process.env.npm_package_version ?? "0.1.0",
    commitSha: maskSha(
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
        process.env.GIT_COMMIT_SHA?.trim() ||
        null,
    ),
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID?.trim() || null,
    vercelEnv: process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || null,
    supabaseProjectRefMasked: maskProjectRef(projectRef),
    schemaVersion: "portal-rbac-20260815+app_data_store-rls-lock-20260904",
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasPolicyEmbedSecret: Boolean(process.env.POLICY_EMBED_SECRET?.trim()),
    hasInspectionEmbedSecret: Boolean(
      process.env.INSPECTION_EMBED_SECRET?.trim() ||
        process.env.POLICY_EMBED_SECRET?.trim(),
    ),
  });
}
