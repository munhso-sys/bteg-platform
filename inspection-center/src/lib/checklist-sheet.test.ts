import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChecklistSheetRows,
  legalMergeMetaByQuestionId,
} from "./checklist-sheet";
import type {
  InspectionTemplateQuestion,
  InspectionTemplateSection,
} from "../types";

function q(
  partial: Partial<InspectionTemplateQuestion> & {
    id: string;
    orderIndex: number;
  },
): InspectionTemplateQuestion {
  return {
    templateId: "t1",
    sectionId: null,
    questionNo: String(partial.orderIndex),
    legalReference: "",
    questionText: `Q${partial.id}`,
    approvedScore: 1,
    active: true,
    ...partial,
  };
}

describe("legalMergeMetaByQuestionId", () => {
  it("merges consecutive questions with the same legalMergeGroupId", () => {
    const questions = [
      q({
        id: "a",
        orderIndex: 1,
        legalReference: "Law A",
        legalMergeGroupId: "g1",
      }),
      q({
        id: "b",
        orderIndex: 2,
        legalReference: "Law A",
        legalMergeGroupId: "g1",
      }),
      q({ id: "c", orderIndex: 3, legalReference: "Law B" }),
    ];
    const rows = buildChecklistSheetRows([], questions);
    const meta = legalMergeMetaByQuestionId(rows);
    assert.equal(meta.get("a")?.rowSpan, 2);
    assert.equal(meta.get("a")?.skip, false);
    assert.equal(meta.get("b")?.skip, true);
    assert.equal(meta.get("c")?.rowSpan, 1);
  });

  it("infers merge from identical consecutive legal text without group id", () => {
    const questions = [
      q({ id: "a", orderIndex: 1, legalReference: "Law A" }),
      q({ id: "b", orderIndex: 2, legalReference: "Law A" }),
      q({ id: "c", orderIndex: 3, legalReference: "Law B" }),
    ];
    const rows = buildChecklistSheetRows([], questions);
    const meta = legalMergeMetaByQuestionId(rows);
    assert.equal(meta.get("a")?.rowSpan, 2);
    assert.equal(meta.get("b")?.skip, true);
    assert.equal(meta.get("c")?.rowSpan, 1);
  });

  it("infers merge when continuation rows have empty legal text", () => {
    const questions = [
      q({ id: "a", orderIndex: 1, legalReference: "Law A" }),
      q({ id: "b", orderIndex: 2, legalReference: "" }),
      q({ id: "c", orderIndex: 3, legalReference: "" }),
      q({ id: "d", orderIndex: 4, legalReference: "Law B" }),
    ];
    const rows = buildChecklistSheetRows([], questions);
    const meta = legalMergeMetaByQuestionId(rows);
    assert.equal(meta.get("a")?.rowSpan, 3);
    assert.equal(meta.get("b")?.skip, true);
    assert.equal(meta.get("c")?.skip, true);
    assert.equal(meta.get("d")?.rowSpan, 1);
  });

  it("does not merge across section rows", () => {
    const sections: InspectionTemplateSection[] = [
      {
        id: "s1",
        templateId: "t1",
        parentId: null,
        sectionNo: "1",
        title: "Section",
        orderIndex: 2,
      },
    ];
    const questions = [
      q({ id: "a", orderIndex: 1, legalReference: "Law A" }),
      q({ id: "b", orderIndex: 3, legalReference: "Law A" }),
    ];
    const rows = buildChecklistSheetRows(sections, questions);
    const meta = legalMergeMetaByQuestionId(rows);
    assert.equal(meta.get("a")?.rowSpan, 1);
    assert.equal(meta.get("b")?.rowSpan, 1);
  });
});
