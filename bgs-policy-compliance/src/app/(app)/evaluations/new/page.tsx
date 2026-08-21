import { PageHeader, Panel } from "@/components/ui/primitives";
import { listPolicies, listPositions, getDb } from "@/lib/db/repository";
import { NewEvaluationForm } from "./new-evaluation-form";

export const dynamic = "force-dynamic";

export default async function NewEvaluationPage() {
  const [policies, positions, db] = await Promise.all([
    listPolicies(),
    listPositions(),
    getDb(),
  ]);
  const clauses = db.policy_clauses
    .filter((c) => !c.is_deleted)
    .slice(0, 2000)
    .map((c) => ({
      id: c.id,
      policy_id: c.policy_id,
      label: `${c.reference_number || "—"} · ${c.text.slice(0, 80)}`,
    }));

  return (
    <div>
      <PageHeader
        title="Шинэ үнэлгээ"
        description="Ажлын байранд зүйл заалтын биелэлтийг үнэлэх"
      />
      <Panel className="max-w-xl">
        <NewEvaluationForm
          policies={policies.map((p) => ({ id: p.id, name: p.name }))}
          positions={positions.slice(0, 618).map((p) => ({ id: p.id, name: p.name }))}
          clauses={clauses}
        />
      </Panel>
    </div>
  );
}
