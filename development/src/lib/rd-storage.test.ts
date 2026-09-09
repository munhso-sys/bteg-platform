import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RD_PROGRAM_BASE_KEY,
  RD_PROJECTS_BASE_KEY,
  clearLegacyRdSharedKeys,
  clearRdUserData,
  isInspectLogoutMessage,
  rdStorageKey,
  readRdJsonArray,
  resolveRdUserIdFromSearch,
  sanitizeRdUserId,
  writeRdJsonArray,
} from "./rd-storage";

function memoryStorage(): {
  store: Map<string, string>;
  api: Storage;
} {
  const store = new Map<string, string>();
  const api = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
  } as Storage;
  return { store, api };
}

describe("RD-D01/D02 storage isolation", () => {
  it("sanitizes and namespaces keys by user", () => {
    assert.equal(sanitizeRdUserId(""), null);
    assert.equal(sanitizeRdUserId("../evil"), null);
    assert.equal(rdStorageKey(RD_PROJECTS_BASE_KEY, null), "rd-research-projects:anonymous");
    assert.equal(
      rdStorageKey(RD_PROJECTS_BASE_KEY, "user-a"),
      "rd-research-projects:user:user-a",
    );
    assert.notEqual(
      rdStorageKey(RD_PROJECTS_BASE_KEY, "user-a"),
      rdStorageKey(RD_PROJECTS_BASE_KEY, "user-b"),
    );
  });

  it("RD-D02: user A data is not visible under user B key", () => {
    const { api } = memoryStorage();
    writeRdJsonArray(api, RD_PROJECTS_BASE_KEY, "user-a", [{ id: "a1" }]);
    writeRdJsonArray(api, RD_PROGRAM_BASE_KEY, "user-a", [{ id: "p1" }]);
    assert.deepEqual(readRdJsonArray(api, RD_PROJECTS_BASE_KEY, "user-a"), [
      { id: "a1" },
    ]);
    assert.equal(readRdJsonArray(api, RD_PROJECTS_BASE_KEY, "user-b"), null);
  });

  it("clears legacy shared keys so old cross-user leakage cannot remain", () => {
    const { api, store } = memoryStorage();
    api.setItem(RD_PROJECTS_BASE_KEY, JSON.stringify([{ id: "legacy" }]));
    api.setItem(RD_PROGRAM_BASE_KEY, JSON.stringify([{ id: "legacy-p" }]));
    clearLegacyRdSharedKeys(api);
    assert.equal(store.has(RD_PROJECTS_BASE_KEY), false);
    assert.equal(store.has(RD_PROGRAM_BASE_KEY), false);
  });

  it("logout clearAllRdKeys removes all RD namespaces", () => {
    const { api, store } = memoryStorage();
    writeRdJsonArray(api, RD_PROJECTS_BASE_KEY, "user-a", [{ id: "a1" }]);
    writeRdJsonArray(api, RD_PROJECTS_BASE_KEY, "user-b", [{ id: "b1" }]);
    clearRdUserData(api, { clearAllRdKeys: true });
    assert.equal(store.size, 0);
  });

  it("resolves rd_uid from search and recognizes logout message", () => {
    assert.equal(resolveRdUserIdFromSearch("?rd_uid=abc-123"), "abc-123");
    assert.equal(resolveRdUserIdFromSearch("theme=dark"), null);
    assert.equal(isInspectLogoutMessage({ type: "inspect-logout" }), true);
    assert.equal(isInspectLogoutMessage({ type: "inspect-theme" }), false);
  });

  it("RD-D01: persistence is local key write (prototype contract)", () => {
    const { api } = memoryStorage();
    const created = [{ id: "rp-new", title: "Synthetic" }];
    writeRdJsonArray(api, RD_PROJECTS_BASE_KEY, "qa-user", created);
    const reloaded = readRdJsonArray(api, RD_PROJECTS_BASE_KEY, "qa-user");
    assert.deepEqual(reloaded, created);
  });
});
