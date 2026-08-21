import type { UnitScope } from "@/lib/rbac/unit-scope";
import { matchesUnitText } from "@/lib/rbac/unit-scope";
import type { VoiceDb } from "@/lib/voice/types";

/** Keep only voice records that belong to the user's heltes/alba. */
export function filterVoiceDbByUnit(db: VoiceDb, scope: UnitScope): VoiceDb {
  if (!scope.active) return db;
  const items = db.items.filter((item) =>
    matchesUnitText(item.department, scope),
  );
  const ids = new Set(items.map((i) => i.id));
  return {
    ...db,
    items,
    actions: db.actions.filter((a) => ids.has(a.voiceId)),
    notices: db.notices.filter((n) => ids.has(n.voiceId)),
  };
}
