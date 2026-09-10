"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Unlink,
} from "lucide-react";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import { RESPONSIBILITY_LABELS, responsibilityTone } from "@/lib/constants";
import {
  ALBA_COMMON_LABEL,
  COMPANY_SCOPE_LABEL,
  HELTES_COMMON_LABEL,
  parseScopeNote,
  SCOPE_EVAL_PREFIX,
  scopeNoteLabel,
} from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type { ResponsibilityType } from "@/lib/types";
import { EditResponsibilityLinkMenu } from "@/components/policies/edit-responsibility-link-menu";
import {
  ClauseEvaluateForm,
  type EvaluateLinkOption,
} from "./clause-evaluate-form";

export type ClauseLinkRow = {
  id: string;
  job_position_id: string;
  responsibility_type: ResponsibilityType;
  notes: string | null;
  positionName: string;
  organizationName: string;
  heltesId: string;
  heltesName: string;
  albaId: string;
  albaName: string;
  score: number | null;
};

type AlbaGroup = {
  key: string;
  label: string;
  items: ClauseLinkRow[];
};

type HeltesGroup = {
  key: string;
  label: string;
  albas: AlbaGroup[];
};

type ScopeKind = "company" | "heltes" | "alba";

type ScopeGroup = {
  key: string;
  label: string;
  items: ClauseLinkRow[];
  responsibility_type: ResponsibilityType;
  kind: ScopeKind;
  tree: HeltesGroup[];
};

function buildOrgTree(rows: ClauseLinkRow[]): HeltesGroup[] {
  const hMap = new Map<string, Map<string, ClauseLinkRow[]>>();
  const labels = new Map<string, { heltes: string; alba: string }>();

  for (const row of rows) {
    const hKey = row.heltesId || "__none__";
    const aKey = row.albaId || "__none__";
    labels.set(`${hKey}::${aKey}`, {
      heltes: row.heltesName || "Ангилагдаагүй",
      alba: row.albaName || "—",
    });
    if (!hMap.has(hKey)) hMap.set(hKey, new Map());
    const aMap = hMap.get(hKey)!;
    if (!aMap.has(aKey)) aMap.set(aKey, []);
    aMap.get(aKey)!.push(row);
  }

  const heltes: HeltesGroup[] = [];
  for (const [hKey, aMap] of hMap) {
    const albas: AlbaGroup[] = [];
    for (const [aKey, items] of aMap) {
      const lab = labels.get(`${hKey}::${aKey}`);
      albas.push({
        key: `${hKey}::${aKey}`,
        label: lab?.alba || aKey,
        items: items.sort((a, b) =>
          a.positionName.localeCompare(b.positionName, "mn"),
        ),
      });
    }
    albas.sort((a, b) => a.label.localeCompare(b.label, "mn"));
    heltes.push({
      key: hKey,
      label: labels.get(albas[0]?.key ?? "")?.heltes || hKey,
      albas,
    });
  }
  heltes.sort((a, b) => a.label.localeCompare(b.label, "mn"));
  return heltes;
}

function buildScopeGroups(rows: ClauseLinkRow[]): ScopeGroup[] {
  const map = new Map<string, ClauseLinkRow[]>();
  for (const row of rows) {
    const scope = parseScopeNote(row.notes);
    if (!scope) continue;
    const key = `${row.notes}::${row.responsibility_type}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  // 1 ширхэгтэй «scope» нь ихэвчлэн хуучин notes үлдэгдэл — хувь ажлын байр шиг харуулна.
  return [...map.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([key, items]) => {
      const sample = items[0];
      const parsed = parseScopeNote(sample.notes);
      const kind: ScopeKind =
        parsed?.kind === "company"
          ? "company"
          : parsed?.kind === "heltes"
            ? "heltes"
            : "alba";
      const label =
        scopeNoteLabel(sample.notes, {
          heltes: sample.heltesName,
          alba: sample.albaName,
          organization: sample.organizationName,
        }) ??
        (kind === "company"
          ? COMPANY_SCOPE_LABEL
          : kind === "heltes"
            ? HELTES_COMMON_LABEL
            : ALBA_COMMON_LABEL);
      return {
        key,
        label: `${label} · ${RESPONSIBILITY_LABELS[sample.responsibility_type]} (${items.length})`,
        items,
        responsibility_type: sample.responsibility_type,
        kind,
        tree: buildOrgTree(items),
      };
    });
}

function FolderHeader({
  open,
  onToggle,
  label,
  meta,
  depth,
  action,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  meta: string;
  depth: number;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 rounded px-1 py-0.5",
        depth === 0 && "bg-slate-50",
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left text-sm hover:bg-slate-100",
          depth === 0 && "font-semibold",
        )}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {open ? (
          <FolderOpen size={16} className="shrink-0 text-orange-500" />
        ) : (
          <Folder size={16} className="shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 text-xs text-slate-500">{meta}</span>
      </button>
      {action}
    </div>
  );
}

function BulkUnlinkButton({
  linkIds,
  label,
}: {
  linkIds: string[];
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onUnlink() {
    if (
      !confirm(
        `“${label}” хамрах хүрээний ${linkIds.length} холбоосыг бүгдийг салгах уу? Холбоотой үнэлгээнүүд мөн устана.`,
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const res = await fetch(withBasePath("/api/responsibilities/bulk-unlink"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: linkIds }),
      });
      if (!res.ok) {
        let message = `Алдаа (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        alert(message);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onUnlink}
      disabled={pending || linkIds.length === 0}
      title="Хамрах хүрээний холбоосыг бүгдийг салгах"
      aria-label="Хамрах хүрээний холбоосыг бүгдийг салгах"
      className="shrink-0 rounded border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
    >
      <Unlink size={14} />
    </button>
  );
}

function PositionRow({
  link: l,
  readOnly,
  showOrgPath,
}: {
  link: ClauseLinkRow;
  readOnly: boolean;
  showOrgPath?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1 hover:bg-slate-50">
      <div className="min-w-0">
        {readOnly ? (
          <span>{l.positionName}</span>
        ) : (
          <Link
            href={`/positions/${l.job_position_id}`}
            className="hover:underline"
          >
            {l.positionName}
          </Link>
        )}
        {showOrgPath ? (
          <div className="text-[11px] text-slate-500">
            {[l.organizationName, l.heltesName, l.albaName]
              .filter(Boolean)
              .join(" · ")}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge className={responsibilityTone(l.responsibility_type)}>
          {RESPONSIBILITY_LABELS[l.responsibility_type]}
        </Badge>
        <ScoreChip score={l.score} />
        {!readOnly ? (
          <EditResponsibilityLinkMenu
            linkIds={[l.id]}
            positionName={l.positionName}
            responsibilityType={l.responsibility_type}
          />
        ) : null}
      </div>
    </li>
  );
}

function AlbaFolderList({
  heltesLabel,
  albas,
  prefix,
  open,
  toggle,
  readOnly,
  depth,
}: {
  heltesLabel: string;
  albas: AlbaGroup[];
  prefix: string;
  open: Set<string>;
  toggle: (key: string) => void;
  readOnly: boolean;
  depth: number;
}) {
  return (
    <>
      {albas.map((a) => {
        const aKey = `${prefix}:a:${a.key}`;
        const aOpen = open.has(aKey);
        return (
          <div key={aKey}>
            <FolderHeader
              open={aOpen}
              onToggle={() => toggle(aKey)}
              label={a.label}
              meta={`${a.items.length}`}
              depth={depth}
              action={
                !readOnly ? (
                  <BulkUnlinkButton
                    linkIds={a.items.map((i) => i.id)}
                    label={`${heltesLabel} · ${a.label}`}
                  />
                ) : null
              }
            />
            {aOpen ? (
              <ul
                className="space-y-1 px-3 pb-2 text-sm"
                style={{ paddingLeft: 16 + (depth + 1) * 14 }}
              >
                {a.items.map((l) => (
                  <PositionRow key={l.id} link={l} readOnly={readOnly} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function NestedOrgFolders({
  tree,
  prefix,
  open,
  toggle,
  readOnly,
  baseDepth,
  /** company = heltes→alba; heltes = alba only */
  mode,
}: {
  tree: HeltesGroup[];
  prefix: string;
  open: Set<string>;
  toggle: (key: string) => void;
  readOnly: boolean;
  baseDepth: number;
  mode: "company" | "heltes";
}) {
  if (mode === "heltes") {
    const albas: AlbaGroup[] = tree.flatMap((h) =>
      h.albas.map((a) => ({
        key: a.key.includes("::") ? a.key : `${h.key}::${a.key}`,
        label:
          tree.length > 1 && a.label !== h.label
            ? `${h.label} · ${a.label}`
            : a.label,
        items: a.items,
      })),
    );
    return (
      <AlbaFolderList
        heltesLabel={tree[0]?.label ?? ""}
        albas={albas}
        prefix={prefix}
        open={open}
        toggle={toggle}
        readOnly={readOnly}
        depth={baseDepth}
      />
    );
  }

  return (
    <>
      {tree.map((h) => {
        const hKey = `${prefix}:h:${h.key}`;
        const hOpen = open.has(hKey);
        const heltesItems = h.albas.flatMap((a) => a.items);
        const count = heltesItems.length;
        const collapseToHeltes =
          h.albas.length === 1 &&
          (h.albas[0].label === h.label ||
            h.albas[0].label === "—" ||
            h.albas[0].key.endsWith("::__none__"));

        if (collapseToHeltes) {
          const a = h.albas[0];
          return (
            <div key={hKey}>
              <FolderHeader
                open={hOpen}
                onToggle={() => toggle(hKey)}
                label={h.label}
                meta={`${count}`}
                depth={baseDepth}
                action={
                  !readOnly ? (
                    <BulkUnlinkButton
                      linkIds={heltesItems.map((i) => i.id)}
                      label={h.label}
                    />
                  ) : null
                }
              />
              {hOpen ? (
                <ul
                  className="space-y-1 px-3 pb-2 text-sm"
                  style={{ paddingLeft: 16 + (baseDepth + 1) * 14 }}
                >
                  {a.items.map((l) => (
                    <PositionRow key={l.id} link={l} readOnly={readOnly} />
                  ))}
                </ul>
              ) : null}
            </div>
          );
        }

        return (
          <div key={hKey}>
            <FolderHeader
              open={hOpen}
              onToggle={() => toggle(hKey)}
              label={h.label}
              meta={`${count}`}
              depth={baseDepth}
              action={
                !readOnly ? (
                  <BulkUnlinkButton
                    linkIds={heltesItems.map((i) => i.id)}
                    label={h.label}
                  />
                ) : null
              }
            />
            {hOpen ? (
              <AlbaFolderList
                heltesLabel={h.label}
                albas={h.albas}
                prefix={prefix}
                open={open}
                toggle={toggle}
                readOnly={readOnly}
                depth={baseDepth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function ClauseLinksPanel({
  clauseId,
  links,
  readOnly,
}: {
  clauseId: string;
  links: ClauseLinkRow[];
  readOnly: boolean;
}) {
  const scopeGroups = useMemo(() => buildScopeGroups(links), [links]);
  const scopedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of scopeGroups) {
      for (const item of g.items) ids.add(item.id);
    }
    return ids;
  }, [scopeGroups]);

  const individualLinks = useMemo(
    () => links.filter((l) => !scopedIds.has(l.id)),
    [links, scopedIds],
  );
  const orgTree = useMemo(
    () => buildOrgTree(individualLinks),
    [individualLinks],
  );

  const [open, setOpen] = useState<Set<string>>(() => {
    const next = new Set<string>();
    for (const g of scopeGroups) {
      next.add(`scope:${g.key}`);
      for (const h of g.tree.slice(0, 2)) {
        next.add(`scope:${g.key}:h:${h.key}`);
        for (const a of h.albas.slice(0, 1)) {
          next.add(`scope:${g.key}:a:${a.key}`);
        }
      }
    }
    for (const h of orgTree.slice(0, 2)) {
      next.add(`ind:h:${h.key}`);
      for (const a of h.albas.slice(0, 1)) next.add(`ind:a:${a.key}`);
    }
    return next;
  });

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const evaluateLinks = useMemo((): EvaluateLinkOption[] => {
    const options: EvaluateLinkOption[] = [];
    for (const g of scopeGroups) {
      if (g.items.length < 2) continue;
      const resp = RESPONSIBILITY_LABELS[g.responsibility_type];
      options.push({
        id: `${SCOPE_EVAL_PREFIX}${g.key}`,
        job_position_ids: g.items.map((i) => i.job_position_id),
        responsibility_type: g.responsibility_type,
        label: `${g.label} — нийтээр үнэлэх`,
        group: "Хамрах хүрээ (нийтээр)",
        isScope: true,
      });

      if (g.kind === "company") {
        for (const h of g.tree) {
          const heltesItems = h.albas.flatMap((a) => a.items);
          if (heltesItems.length >= 2) {
            options.push({
              id: `${SCOPE_EVAL_PREFIX}${g.key}::heltes:${h.key}`,
              job_position_ids: heltesItems.map((i) => i.job_position_id),
              responsibility_type: g.responsibility_type,
              label: `${h.label} · ${resp} (${heltesItems.length}) — нийтээр үнэлэх`,
              group: "Хэлтэсээр (нийтээр)",
              isScope: true,
            });
          }
          for (const a of h.albas) {
            if (a.items.length < 2) continue;
            options.push({
              id: `${SCOPE_EVAL_PREFIX}${g.key}::alba:${a.key}`,
              job_position_ids: a.items.map((i) => i.job_position_id),
              responsibility_type: g.responsibility_type,
              label: `${h.label} · ${a.label} · ${resp} (${a.items.length}) — нийтээр үнэлэх`,
              group: `${h.label} / албаар`,
              isScope: true,
            });
          }
        }
      } else if (g.kind === "heltes") {
        for (const h of g.tree) {
          for (const a of h.albas) {
            if (a.items.length < 2) continue;
            options.push({
              id: `${SCOPE_EVAL_PREFIX}${g.key}::alba:${a.key}`,
              job_position_ids: a.items.map((i) => i.job_position_id),
              responsibility_type: g.responsibility_type,
              label: `${a.label} · ${resp} (${a.items.length}) — нийтээр үнэлэх`,
              group: "Албаар (нийтээр)",
              isScope: true,
            });
          }
        }
      }
    }
    for (const l of links) {
      options.push({
        id: `${l.job_position_id}::${l.responsibility_type}`,
        job_position_ids: [l.job_position_id],
        responsibility_type: l.responsibility_type,
        label: `${l.positionName} · ${RESPONSIBILITY_LABELS[l.responsibility_type]}`,
        group: [l.heltesName, l.albaName].filter(Boolean).join(" · ") || "Бусад",
        isScope: false,
        heltesName: l.heltesName,
        albaName: l.albaName,
        positionName: l.positionName,
      });
    }
    return options;
  }, [scopeGroups, links]);

  if (!links.length) {
    return (
      <p className="text-sm text-slate-500">Хариуцлагын холбоос байхгүй.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[28rem] overflow-auto rounded border border-slate-200">
        {scopeGroups.map((g) => {
          const key = `scope:${g.key}`;
          const isOpen = open.has(key);
          const nestTree =
            g.kind === "company" || g.kind === "heltes" ? g.tree : [];
          return (
            <div key={key} className="border-b border-slate-100">
              <FolderHeader
                open={isOpen}
                onToggle={() => toggle(key)}
                label={g.label}
                meta={`${g.items.length}`}
                depth={0}
                action={
                  !readOnly ? (
                    <BulkUnlinkButton
                      linkIds={g.items.map((i) => i.id)}
                      label={g.label}
                    />
                  ) : null
                }
              />
              {isOpen ? (
                nestTree.length > 0 &&
                (g.kind === "company" || g.kind === "heltes") ? (
                  <NestedOrgFolders
                    tree={nestTree}
                    prefix={`scope:${g.key}`}
                    open={open}
                    toggle={toggle}
                    readOnly={readOnly}
                    baseDepth={1}
                    mode={g.kind}
                  />
                ) : (
                  <ul className="space-y-1 px-3 pb-2 pl-10 text-sm">
                    {g.items
                      .slice()
                      .sort((a, b) =>
                        a.positionName.localeCompare(b.positionName, "mn"),
                      )
                      .map((l) => (
                        <PositionRow
                          key={l.id}
                          link={l}
                          readOnly={readOnly}
                          showOrgPath
                        />
                      ))}
                  </ul>
                )
              ) : null}
            </div>
          );
        })}

        {orgTree.map((h) => {
          const hKey = `ind:h:${h.key}`;
          const hOpen = open.has(hKey);
          const heltesItems = h.albas.flatMap((a) => a.items);
          const count = heltesItems.length;
          return (
            <div
              key={hKey}
              className="border-b border-slate-100 last:border-b-0"
            >
              <FolderHeader
                open={hOpen}
                onToggle={() => toggle(hKey)}
                label={h.label}
                meta={`${count}`}
                depth={0}
                action={
                  !readOnly ? (
                    <BulkUnlinkButton
                      linkIds={heltesItems.map((i) => i.id)}
                      label={h.label}
                    />
                  ) : null
                }
              />
              {hOpen
                ? h.albas.map((a) => {
                    const aKey = `ind:a:${a.key}`;
                    const aOpen = open.has(aKey);
                    return (
                      <div key={aKey}>
                        <FolderHeader
                          open={aOpen}
                          onToggle={() => toggle(aKey)}
                          label={a.label}
                          meta={`${a.items.length}`}
                          depth={1}
                          action={
                            !readOnly ? (
                              <BulkUnlinkButton
                                linkIds={a.items.map((i) => i.id)}
                                label={`${h.label} · ${a.label}`}
                              />
                            ) : null
                          }
                        />
                        {aOpen ? (
                          <ul className="space-y-1 px-3 pb-2 pl-12 text-sm">
                            {a.items.map((l) => (
                              <PositionRow
                                key={l.id}
                                link={l}
                                readOnly={readOnly}
                              />
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })
                : null}
            </div>
          );
        })}
      </div>

      {!readOnly ? (
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">
            Холбогдсон ажлын байрыг үнэлэх
          </div>
          <ClauseEvaluateForm clauseId={clauseId} links={evaluateLinks} />
        </div>
      ) : null}
    </div>
  );
}
