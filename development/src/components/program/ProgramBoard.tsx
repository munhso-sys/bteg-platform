"use client";

import { useMemo, useState } from "react";
import type { ElementType } from "react";
import { Bot, Megaphone, ShieldAlert } from "lucide-react";
import { InitiativeModal } from "@/components/program/InitiativeModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import {
  QuarterCells,
  QuarterHeaders,
  QuarterLegend,
} from "@/components/QuarterCells";
import { StatusBadge } from "@/components/StatusBadge";
import { pillars } from "@/lib/program-data";
import { emptyInitiative, useProgramInitiatives } from "@/lib/program-store";
import {
  calendarQuarter,
  effectiveStatus,
  QUARTER_META,
} from "@/lib/quarters";
import type { ProgramInitiative, ProgramPillarId } from "@/lib/types";

const pillarIcon: Record<ProgramPillarId, ElementType> = {
  research: Megaphone,
  productivity: ShieldAlert,
  "digital-learning": Bot,
};

type FilterId = "all" | "current" | "delayed";

export function ProgramBoard() {
  const { items, save, remove, cycleQuarter } = useProgramInitiatives();
  const now = calendarQuarter();
  const [year, setYear] = useState(now.year);
  const [filter, setFilter] = useState<FilterId>("all");
  const [editing, setEditing] = useState<ProgramInitiative | null>(null);
  const [createMode, setCreateMode] = useState(false);

  const currentMeta = QUARTER_META.find((q) => q.key === now.key);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (item.year !== year) return false;
      if (filter === "current") {
        return item.quarters[now.key] !== "none";
      }
      if (filter === "delayed") {
        return effectiveStatus(item) === "delayed";
      }
      return true;
    });
  }, [filter, items, now.key, year]);

  return (
    <div>
      <PageHeader
        title="Хөтөлбөрийн ажил"
        subtitle="Судалгаа, бүтээмж, цахим шилжилтийн ажлын явц, улирлын гүйцэтгэл"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setCreateMode(true);
              setEditing(emptyInitiative("research", year));
            }}
          >
            + Шинэ ажил
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="select w-auto"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          aria-label="Жил"
        >
          {Array.from(
            new Set([
              now.year - 1,
              now.year,
              now.year + 1,
              ...items.map((item) => item.year),
            ]),
          )
            .sort((a, b) => a - b)
            .map((value) => (
              <option key={value} value={value}>
                {value} он
              </option>
            ))}
        </select>
        <span className="rounded-md border border-[var(--brand)] bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-[var(--brand-dark)]">
          Одоо: {now.year} оны {currentMeta?.label} улирал ({currentMeta?.months})
        </span>
        {(
          [
            ["all", "Бүгд"],
            ["current", "Энэ улирал"],
            ["delayed", "Хоцорсон"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn ${filter === id ? "btn-primary" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <QuarterLegend />
        <p className="mt-2 text-xs text-[var(--muted)]">
          I–IV нь тухайн ажлыг аль улиралд хийхийг төлөвлөсөн багана. Одоогийн
          улирал хуанлигаас автоматаар тодорно. Нүдийг дараад төлөвлөгөө/гүйцэтгэлийг
          гараар солино.
        </p>
      </div>

      <div className="space-y-4">
        {pillars.map((pillar) => {
          const Icon = pillarIcon[pillar.id];
          const rows = visible.filter((item) => item.pillarId === pillar.id);
          return (
            <section
              key={pillar.id}
              className="rounded-md border border-[var(--border)] bg-white"
            >
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                <span className="rounded border border-[var(--border)] bg-slate-50 px-2 py-0.5 text-xs font-semibold">
                  {pillar.no}
                </span>
                <Icon size={16} className="text-[var(--brand)]" />
                <div>
                  <h2 className="text-sm font-semibold">{pillar.title}</h2>
                  <p className="text-xs text-[var(--muted)]">{pillar.description}</p>
                </div>
              </div>
              <div className="overflow-x-auto p-1">
                <table className="min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="w-8">№</th>
                      <th>Ажил</th>
                      <th>Хариуцах</th>
                      <th>Оноо</th>
                      <th>Төлөв</th>
                      <QuarterHeaders year={year} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-4 text-sm text-[var(--muted)]">
                          Энэ шүүлтээр ажил алга.
                        </td>
                      </tr>
                    ) : (
                      rows.map((item) => (
                        <tr
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => {
                            setCreateMode(false);
                            setEditing(item);
                          }}
                        >
                          <td className="text-sm">{item.no}</td>
                          <td>
                            <div className="text-sm font-semibold">{item.title}</div>
                            <div className="mt-1 text-xs text-[var(--muted)]">
                              {item.department}
                              {item.start_date || item.end_date
                                ? ` · ${item.start_date || "?"} – ${item.end_date || "?"}`
                                : ""}
                            </div>
                          </td>
                          <td className="text-sm">{item.owner}</td>
                          <td className="w-24">
                            <div className="text-sm font-semibold">
                              {item.score}/{item.target}
                            </div>
                            <ProgressBar value={item.score} />
                          </td>
                          <td>
                            <StatusBadge status={effectiveStatus(item)} />
                          </td>
                          <QuarterCells
                            item={item}
                            interactive
                            onToggle={(key) => cycleQuarter(item.id, key)}
                          />
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {editing ? (
        <InitiativeModal
          item={editing}
          createMode={createMode}
          onClose={() => {
            setEditing(null);
            setCreateMode(false);
          }}
          onSave={(next) => {
            save(next);
            setEditing(null);
            setCreateMode(false);
          }}
          onDelete={(id) => {
            remove(id);
            setEditing(null);
            setCreateMode(false);
          }}
        />
      ) : null}
    </div>
  );
}
