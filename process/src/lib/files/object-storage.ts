import { createServiceRoleClient } from "@/lib/supabase/server";
import { preferRemoteStore } from "@/lib/db/remote-store";

export const PROCESS_UPLOADS_BUCKET = "process-uploads";

const STORAGE_PREFIX = "supabase:";

export function isRemoteObjectPath(filePath: string) {
  return filePath.startsWith(STORAGE_PREFIX);
}

export function toStorageObjectPath(processId: string, fileName: string) {
  return `${processId}/${fileName}`;
}

export function toRemoteFilePath(objectPath: string) {
  return `${STORAGE_PREFIX}${PROCESS_UPLOADS_BUCKET}/${objectPath}`;
}

export function parseRemoteFilePath(filePath: string): {
  bucket: string;
  objectPath: string;
} | null {
  if (!isRemoteObjectPath(filePath)) return null;
  const rest = filePath.slice(STORAGE_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return {
    bucket: rest.slice(0, slash),
    objectPath: rest.slice(slash + 1),
  };
}

async function ensureBucket() {
  const client = createServiceRoleClient();
  if (!client) throw new Error("Supabase service role not configured");
  const { data: buckets } = await client.storage.listBuckets();
  const exists = (buckets ?? []).some((b) => b.name === PROCESS_UPLOADS_BUCKET);
  if (!exists) {
    const { error } = await client.storage.createBucket(PROCESS_UPLOADS_BUCKET, {
      public: false,
      fileSizeLimit: 40 * 1024 * 1024,
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Create bucket failed: ${error.message}`);
    }
  }
  return client;
}

export function preferObjectStorage() {
  return preferRemoteStore();
}

export async function uploadProcessObject(
  processId: string,
  fileName: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  const client = await ensureBucket();
  const objectPath = toStorageObjectPath(processId, fileName);
  const { error } = await client.storage
    .from(PROCESS_UPLOADS_BUCKET)
    .upload(objectPath, buf, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return toRemoteFilePath(objectPath);
}

export async function downloadProcessObject(filePath: string): Promise<Buffer> {
  const parsed = parseRemoteFilePath(filePath);
  if (!parsed) throw new Error("Not a remote storage path");
  const client = createServiceRoleClient();
  if (!client) throw new Error("Supabase service role not configured");
  const { data, error } = await client.storage
    .from(parsed.bucket)
    .download(parsed.objectPath);
  if (error || !data) {
    throw new Error(error?.message || "Storage download failed");
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}
