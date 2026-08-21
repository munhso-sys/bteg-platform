import Link from "next/link";
import {
  RESPONSIBILITY_SHORT,
  responsibilityTone,
} from "@/lib/constants";
import type { ClauseTreeNode } from "@/lib/types";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import { truncate } from "@/lib/utils";

function ClauseNode({
  node,
  depth,
  positionNames,
  scores,
}: {
  node: ClauseTreeNode;
  depth: number;
  positionNames: Map<string, string>;
  scores: Map<string, number>;
}) {
  return (
    <li className="border-l border-slate-200">
      <div
        className="flex flex-col gap-1 border-b border-slate-100 py-2 pr-2"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">
                {node.reference_number || "—"}
              </span>
              <Link
                href={`/clauses/${node.id}`}
                className="text-sm font-medium text-slate-900 hover:underline"
              >
                {truncate(node.text || "(хоосон зүйл)", 160)}
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {node.responsibilities.map((r) => {
              const key = `${r.policy_clause_id}:${r.job_position_id}:${r.responsibility_type}`;
              return (
                <Link
                  key={r.id}
                  href={`/positions/${r.job_position_id}`}
                  className="inline-flex"
                >
                  <Badge className={responsibilityTone(r.responsibility_type)}>
                    {RESPONSIBILITY_SHORT[r.responsibility_type]} ·{" "}
                    {truncate(positionNames.get(r.job_position_id) ?? r.job_position_id, 28)}
                    {scores.has(key) ? (
                      <>
                        {" "}
                        <ScoreChip score={scores.get(key)} />
                      </>
                    ) : null}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <ClauseNode
              key={child.id}
              node={child}
              depth={depth + 1}
              positionNames={positionNames}
              scores={scores}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ClauseTree({
  tree,
  positionNames,
  scores,
}: {
  tree: ClauseTreeNode[];
  positionNames: Map<string, string>;
  scores?: Map<string, number>;
}) {
  if (!tree.length) {
    return <p className="text-sm text-slate-500">Энэ хэсэгт зүйл заалт байхгүй.</p>;
  }
  return (
    <ul className="text-sm">
      {tree.map((node) => (
        <ClauseNode
          key={node.id}
          node={node}
          depth={0}
          positionNames={positionNames}
          scores={scores ?? new Map()}
        />
      ))}
    </ul>
  );
}
