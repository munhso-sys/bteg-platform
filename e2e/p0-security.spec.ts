import { expect, test } from "@playwright/test";
import { developmentUrl, inspectionUrl, portalUrl } from "./helpers";

/**
 * Legacy probes kept for coverage, but no longer skip when URLs unset —
 * the gate runner always sets E2E_* URLs. Fail closed if missing.
 */
test.describe("legacy p0 HTTP probes", () => {
  test("URLs configured", () => {
    expect(portalUrl()).toMatch(/^http/);
    expect(inspectionUrl()).toMatch(/^http/);
    expect(developmentUrl()).toMatch(/^http/);
  });
});
