import path from "path";

/** Bundled seed files shipped with the deployment (read-only on Vercel). */
export function getBundledLocalDataDir() {
  return path.join(process.cwd(), "data", "local");
}

/**
 * Writable runtime data directory.
 * On Vercel the deployment FS is read-only — use /tmp (per-instance).
 */
export function getLocalDataDir() {
  if (process.env.DATA_DIR?.trim()) return process.env.DATA_DIR.trim();
  if (process.env.VERCEL || process.env.USE_TMP_DATA === "1") {
    return path.join("/tmp", "bgs-policy-compliance");
  }
  return getBundledLocalDataDir();
}

export function isReadOnlyFsError(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    code === "EROFS" ||
    /read-only file system/i.test(message) ||
    /erofs/i.test(message)
  );
}

export function readOnlyFsUserMessage() {
  return "Production сервер дээр файлд хадгалах боломжгүй. Өөрчлөлт түр хадгалагдана; бүрэн хадгалалтад Supabase холбох хэрэгтэй.";
}
