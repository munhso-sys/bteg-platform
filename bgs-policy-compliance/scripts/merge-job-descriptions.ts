#!/usr/bin/env tsx
/**
 * Merge full АБТ from BGS_export (JSON + markdown) into data/local/db.json
 * without wiping policies/evaluations/overrides.
 *
 * Usage:
 *   npx tsx scripts/merge-job-descriptions.ts [path-to-extracted-export]
 *
 * Default:
 *   data/import/BGS_export
 */

import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import type { JobDescription, LocalDatabase } from "../src/lib/types";

const DEFAULT_EXPORT = path.join(process.cwd(), "data", "import", "BGS_export");

function pickLonger(a: string | null | undefined, b: string | null | undefined) {
  const aa = (a ?? "").trim();
  const bb = (b ?? "").trim();
  if (!aa) return bb || null;
  if (!bb) return aa || null;
  return bb.length > aa.length ? bb : aa;
}

function pickTextOrList(
  a: string | string[] | null | undefined,
  b: string | string[] | null | undefined,
): string | string[] | null {
  const len = (v: string | string[] | null | undefined) => {
    if (v == null) return 0;
    if (Array.isArray(v)) return v.join("\n").length;
    return String(v).length;
  };
  if (!len(a)) return b ?? null;
  if (!len(b)) return a ?? null;
  return len(b) > len(a) ? (b ?? null) : (a ?? null);
}

function pickArray(a: unknown, b: unknown): unknown[] {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  if (!aa.length) return bb;
  if (!bb.length) return aa;
  return bb.length > aa.length ? bb : aa;
}

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

async function walkMd(dir: string, acc: string[] = []): Promise<string[]> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walkMd(p, acc);
    else if (e.name.toLowerCase().endsWith(".md")) acc.push(p);
  }
  return acc;
}

function mapExportJd(
  d: Record<string, unknown>,
  markdownBody: string | null,
): JobDescription {
  return {
    id: String(d.id),
    job_position_id: String(d.job_position_id),
    title: d.title != null ? String(d.title) : null,
    a_code: d.a_code != null ? String(d.a_code) : null,
    purpose: d.purpose != null ? String(d.purpose) : null,
    schedule: d.schedule != null ? String(d.schedule) : null,
    daily_hours: d.daily_hours != null ? String(d.daily_hours) : null,
    break_time: d.break_time != null ? String(d.break_time) : null,
    duties: Array.isArray(d.duties) ? d.duties : [],
    education_level: d.education_level != null ? String(d.education_level) : null,
    work_experience: d.work_experience != null ? String(d.work_experience) : null,
    general_skills: Array.isArray(d.general_skills) ? d.general_skills : [],
    professional_skills: Array.isArray(d.professional_skills)
      ? d.professional_skills
      : [],
    authority: d.authority != null ? String(d.authority) : null,
    responsibilities: d.responsibilities != null ? String(d.responsibilities) : null,
    relevant_laws: Array.isArray(d.relevant_laws) ? d.relevant_laws : [],
    job_condition: d.job_condition != null ? String(d.job_condition) : null,
    resources: d.resources != null ? String(d.resources) : null,
    communication_scope: d.communication_scope ?? null,
    supervisor_positions: Array.isArray(d.supervisor_positions)
      ? d.supervisor_positions
      : Array.isArray(d.supervisor_pos_id)
        ? d.supervisor_pos_id
        : [],
    subordinate_positions: Array.isArray(d.subordinate_positions)
      ? d.subordinate_positions
      : Array.isArray(d.subordinate_pos_id)
        ? d.subordinate_pos_id
        : [],
    markdown_body: markdownBody,
    raw: d,
  };
}

function mergeJd(prev: JobDescription | undefined, next: JobDescription): JobDescription {
  if (!prev) return next;
  return {
    id: prev.id || next.id,
    job_position_id: next.job_position_id,
    title: pickLonger(prev.title, next.title),
    a_code: pickLonger(prev.a_code, next.a_code),
    purpose: pickLonger(prev.purpose, next.purpose),
    schedule: pickLonger(prev.schedule, next.schedule),
    daily_hours: pickLonger(prev.daily_hours, next.daily_hours),
    break_time: pickLonger(prev.break_time, next.break_time),
    duties: pickArray(prev.duties, next.duties),
    education_level: pickLonger(prev.education_level, next.education_level),
    work_experience: pickLonger(prev.work_experience, next.work_experience),
    general_skills: pickArray(prev.general_skills, next.general_skills),
    professional_skills: pickArray(
      prev.professional_skills,
      next.professional_skills,
    ),
    authority: pickTextOrList(prev.authority, next.authority),
    responsibilities: pickTextOrList(
      prev.responsibilities,
      next.responsibilities,
    ),
    relevant_laws: pickArray(prev.relevant_laws, next.relevant_laws),
    job_condition: pickLonger(prev.job_condition, next.job_condition),
    resources: pickLonger(prev.resources, next.resources),
    communication_scope: next.communication_scope ?? prev.communication_scope,
    supervisor_positions: pickArray(
      prev.supervisor_positions,
      next.supervisor_positions,
    ),
    subordinate_positions: pickArray(
      prev.subordinate_positions,
      next.subordinate_positions,
    ),
    markdown_body: pickLonger(prev.markdown_body, next.markdown_body),
    raw: next.raw ?? prev.raw,
  };
}

async function main() {
  const exportRoot = process.argv[2] || DEFAULT_EXPORT;
  const rawPath = path.join(exportRoot, "01_RAW_JSON", "job_description.json");
  const mdRoot = path.join(exportRoot, "Job_descriptions");
  const dbPath = path.join(process.cwd(), "data", "local", "db.json");

  const descriptionsRaw = JSON.parse(
    await fs.readFile(rawPath, "utf8"),
  ) as Array<Record<string, unknown>>;

  const mdById = new Map<string, string>();
  for (const file of await walkMd(mdRoot)) {
    const text = await fs.readFile(file, "utf8");
    const m = text.match(/\*\*ID:\*\*\s*([0-9a-f-]{36})/i);
    if (m) mdById.set(m[1].toLowerCase(), text);
  }

  const db = JSON.parse(await fs.readFile(dbPath, "utf8")) as LocalDatabase;
  const byPosition = new Map(
    db.job_descriptions.map((d) => [d.job_position_id, d] as const),
  );

  let inserted = 0;
  let updated = 0;
  for (const raw of descriptionsRaw) {
    const id = String(raw.id).toLowerCase();
    const mapped = mapExportJd(raw, mdById.get(id) ?? null);
    const prev = byPosition.get(mapped.job_position_id);
    if (!prev) inserted += 1;
    else updated += 1;
    byPosition.set(mapped.job_position_id, mergeJd(prev, mapped));
  }

  // Attach markdown to existing rows when ID matches even if not in this export pass
  for (const [posId, jd] of byPosition) {
    const md = mdById.get(String(jd.id).toLowerCase());
    if (md && !(jd.markdown_body && jd.markdown_body.length > md.length)) {
      byPosition.set(posId, { ...jd, markdown_body: md });
    }
  }

  db.job_descriptions = [...byPosition.values()];
  await fs.copyFile(dbPath, `${dbPath}.bak`).catch(() => undefined);
  await fs.writeFile(dbPath, JSON.stringify(db), "utf8");

  console.log(
    JSON.stringify(
      {
        export_json: descriptionsRaw.length,
        markdown_files: mdById.size,
        db_job_descriptions: db.job_descriptions.length,
        inserted,
        updated,
        with_markdown: db.job_descriptions.filter((d) => d.markdown_body).length,
        with_purpose: db.job_descriptions.filter((d) => d.purpose?.trim()).length,
        with_duties: db.job_descriptions.filter(
          (d) => Array.isArray(d.duties) && d.duties.length,
        ).length,
      },
      null,
      2,
    ),
  );
}

const isDirect =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { asText };
