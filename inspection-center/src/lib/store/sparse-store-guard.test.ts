import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Mirrors isSparseInspectionStorePayload in index.ts (keep in sync).
 *
 * Guard condition: runs===0 && answers===0 && findings===0
 * Applied in queueRemoteWrite when key === REMOTE_KEYS.store (prod, non-local),
 * unless STORE_ALLOW_SPARSE_REMOTE_WRITE=1.
 *
 * Also required: hydrate must NOT call saveRemotePayload for store when local
 * is newer (that path wiped prod on timeout/seed).
 *
 * Does not clear any collections — only refuses the remote upsert.
 * Legitimate small writes (any of runs/answers/findings non-empty) still allowed.
 */
function isSparseInspectionStorePayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return true;
  const data = payload as {
    runs?: unknown[];
    answers?: unknown[];
    findings?: unknown[];
    templates?: unknown[];
    actions?: unknown[];
    evidence?: unknown[];
  };
  const runs = Array.isArray(data.runs) ? data.runs.length : 0;
  const answers = Array.isArray(data.answers) ? data.answers.length : 0;
  const findings = Array.isArray(data.findings) ? data.findings.length : 0;
  return runs === 0 && answers === 0 && findings === 0;
}

function wouldRefuseSparseStoreWrite(payload: unknown): boolean {
  return isSparseInspectionStorePayload(payload);
}

describe("sparse inspection store guard", () => {
  it("A: healthy hydrated store — legitimate write allowed", () => {
    assert.equal(
      wouldRefuseSparseStoreWrite({
        templates: [{ id: "t1" }],
        runs: [{ id: "r1" }],
        answers: [{ id: "a1" }],
        findings: [{ id: "f1" }],
        actions: [],
        evidence: [],
      }),
      false,
    );
  });

  it("B: hydration timeout + empty seed — remote write BLOCKED", () => {
    assert.equal(wouldRefuseSparseStoreWrite(null), true);
    assert.equal(wouldRefuseSparseStoreWrite({}), true);
    assert.equal(
      wouldRefuseSparseStoreWrite({
        templates: [{ id: "t1" }],
        runs: [],
        answers: [],
        findings: [],
      }),
      true,
    );
  });

  it("C: sparse empty ops BLOCKED; partial restore (answers=77) NOT sparse", () => {
    assert.equal(
      wouldRefuseSparseStoreWrite({
        templates: Array.from({ length: 36 }, (_, i) => ({ id: `t${i}` })),
        runs: [],
        answers: [],
        findings: [],
        evidence: [],
      }),
      true,
    );
    // Relative underfill is NOT the guard predicate — only all-three empty.
    assert.equal(
      wouldRefuseSparseStoreWrite({
        templates: Array.from({ length: 36 }, (_, i) => ({ id: `t${i}` })),
        runs: [{ id: "r1" }],
        answers: Array.from({ length: 77 }, (_, i) => ({ id: `a${i}` })),
        findings: Array.from({ length: 37 }, (_, i) => ({ id: `f${i}` })),
        evidence: [],
      }),
      false,
    );
  });

  it("D: small legitimate mutation after valid hydrate — write allowed", () => {
    assert.equal(
      wouldRefuseSparseStoreWrite({
        runs: [{ id: "r1" }],
        answers: [],
        findings: [],
      }),
      false,
    );
    assert.equal(
      wouldRefuseSparseStoreWrite({
        runs: [],
        answers: [{ id: "a1" }],
        findings: [],
      }),
      false,
    );
    assert.equal(
      wouldRefuseSparseStoreWrite({
        runs: [],
        answers: [],
        findings: [{ id: "f1" }],
      }),
      false,
    );
  });

  it("E: guard does not clear templates/runs/answers/findings/actions/evidence", () => {
    const payload = {
      templates: [{ id: "t1" }],
      runs: [] as unknown[],
      answers: [] as unknown[],
      findings: [] as unknown[],
      actions: [{ id: "x" }],
      evidence: [{ id: "e" }],
    };
    assert.equal(wouldRefuseSparseStoreWrite(payload), true);
    assert.equal(payload.templates.length, 1);
    assert.equal(payload.runs.length, 0);
    assert.equal(payload.answers.length, 0);
    assert.equal(payload.findings.length, 0);
    assert.equal(payload.actions.length, 1);
    assert.equal(payload.evidence.length, 1);
  });
});
