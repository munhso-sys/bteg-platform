import { createClient } from "@/lib/supabase/server";

/** Pass portal-authenticated user id into the Process iframe (display only). */
export async function buildProcessEmbedOptions(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;
  return {
    entryPath: "/processes",
    query: {
      uid: user.id,
    },
  };
}
