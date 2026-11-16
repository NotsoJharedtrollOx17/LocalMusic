import { beforeEach, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("./browser", () => ({ BrowserMusic: class {} }));
beforeEach(() => { vi.resetModules(); invoke.mockReset(); });

it("prepares legacy album tags once and republishes the resulting revision", async () => {
  const legacy = { revision: 1, tracks: [{ id: "song", orderMetadataRead: false }], albums: [], artists: [] };
  const prepared = { ...legacy, revision: 2, tracks: [{ id: "song", orderMetadataRead: true }] };
  invoke.mockResolvedValueOnce(legacy).mockResolvedValueOnce(undefined).mockResolvedValueOnce(prepared).mockResolvedValueOnce(prepared);
  const { api } = await import("./index");
  expect((await api.catalogIndex()).revision).toBe(2);
  expect(invoke).toHaveBeenNthCalledWith(2, "list_tracks", {
    query: "", offset: 0, limit: 1, favoriteOnly: false, sort: "title",
  });
  expect((await api.catalogIndex()).revision).toBe(2);
  expect(invoke.mock.calls.filter(([name]) => name === "list_tracks")).toHaveLength(1);
});

it("ready catalogs use only the metadata index without opening source files", async () => {
  invoke.mockResolvedValue({ revision: 9, tracks: [{ id: "song", orderMetadataRead: true, releaseMetadataRead: true }], albums: [], artists: [] });
  const { api } = await import("./index");
  await api.catalogIndex();
  await api.catalogIndex();
  expect(invoke.mock.calls.map(([name]) => name)).toEqual(["catalog_index", "catalog_index"]);
});
