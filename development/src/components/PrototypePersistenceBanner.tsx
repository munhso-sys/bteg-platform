"use client";

/** RD-D01: honest prototype labeling — not multi-device / not org-isolated server data. */
export function PrototypePersistenceBanner() {
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
    >
      <strong className="font-semibold">Локал прототип.</strong> Энэ модулийн
      өгөгдөл зөвхөн энэ браузерт хадгалагдана — төхөөрөмж/хэрэглэгч хооронд
      серверээр хуваалцахгүй. Production multi-device persistence хараахан
      холбогдоогүй.
    </div>
  );
}
