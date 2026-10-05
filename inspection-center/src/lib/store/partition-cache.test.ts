import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReuseStorePartition,
  storePartitionKey,
} from "./partition-cache";

describe("inspection store partition cache", () => {
  it("uses a stable global key without an organization", () => {
    assert.equal(storePartitionKey(null), "global");
    assert.equal(storePartitionKey("  "), "global");
  });

  it("normalizes organization keys", () => {
    assert.equal(storePartitionKey("  unit-1 "), "org:unit-1");
  });

  it("never reuses a warm cache across organizations or full scope", () => {
    assert.equal(canReuseStorePartition("org:unit-1", "org:unit-1"), true);
    assert.equal(canReuseStorePartition("org:unit-1", "org:unit-2"), false);
    assert.equal(canReuseStorePartition("org:unit-1", "global"), false);
    assert.equal(canReuseStorePartition(undefined, "global"), false);
  });
});
