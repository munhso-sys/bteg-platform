import { createClient } from "@/lib/supabase/server";

/** Must match development module `RD_UID_QUERY` (`rd_uid`). */
export const DEVELOPMENT_RD_UID_QUERY = "rd_uid";

/**
 * Pass portal-authenticated user id into the R&D iframe (RD-D02).
 * Query binds localStorage namespace — not a privilege grant.
 */
export async function buildDevelopmentEmbedOptions(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;
  return {
    entryPath: "/dashboard",
    query: {
      [DEVELOPMENT_RD_UID_QUERY]: user.id,
    },
  };
}
