import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateRunScore,
  deriveComplianceStatus,
  mapRiskLevel,
} from "./index";

describe("scoring", () => {
  it("calculates compliance and risk from applicable answers", () => {
    const score = calculateRunScore([
      { isApplicable: true, approvedScore: 100, receivedScore: 0 },
      { isApplicable: true, approvedScore: 50, receivedScore: 50 },
      { isApplicable: false, approvedScore: 25, receivedScore: 0 },
    ]);

    assert.equal(score.applicableQuestionCount, 2);
    assert.equal(score.passedQuestionCount, 1);
    assert.equal(score.failedQuestionCount, 1);
    assert.equal(score.approvedScoreTotal, 150);
    assert.equal(score.receivedScoreTotal, 50);
    assert.equal(score.failedScoreTotal, 50);
    assert.ok(Math.abs(score.compliancePercent - 100 / 150) < 1e-9);
    assert.ok(Math.abs(score.riskPercent - 50 / 150) < 1e-9);
    assert.equal(score.riskLevel, "Дунд");
  });

  it("maps risk thresholds", () => {
    assert.equal(mapRiskLevel(0.1), "Бага");
    assert.equal(mapRiskLevel(0.3), "Дунд");
    assert.equal(mapRiskLevel(0.6), "Их");
  });

  it("derives compliance status", () => {
    assert.equal(deriveComplianceStatus(false, 10, 0), "not_applicable");
    assert.equal(deriveComplianceStatus(true, 10, 0), "pass");
    assert.equal(deriveComplianceStatus(true, 10, 10), "fail");
    assert.equal(deriveComplianceStatus(true, 10, 5), "partial");
  });
});
