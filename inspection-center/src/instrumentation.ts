export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureStoreHydrated } = await import("@/lib/store");
  await ensureStoreHydrated();
}
