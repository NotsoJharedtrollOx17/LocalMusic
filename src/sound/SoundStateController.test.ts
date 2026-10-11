import { describe, expect, test, vi } from "vitest";
import { SoundStateController } from "./SoundStateController";
import { defaultSound } from "./model";
import type { SoundConfig, SoundState } from "./types";
function state(config = defaultSound()): SoundState {
  return {
    config,
    supported: true,
    systemPanel: false,
    status: "ready",
    sampleRate: 48000,
    channels: 2,
    attenuation: 0,
    bypass: false,
    inactiveBands: [],
    personalAvailable: true,
    routeMonitoring: true,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function backend() {
  return {
    soundCapabilities: vi.fn(async () => state()),
    setSound: vi.fn(async (config: SoundConfig) => state(config)),
    soundAction: vi.fn(async () => state()),
  };
}
describe("app-owned sound coordination", () => {
  test("an old poll cannot replace edited gains, preamp or runtime state", async () => {
    const api = backend(),
      controller = new SoundStateController(api);
    await controller.refresh();
    const read = deferred<SoundState>();
    api.soundCapabilities.mockReturnValueOnce(read.promise);
    const polling = controller.refresh();
    await Promise.resolve();
    controller.edit((c) => ({
      ...c,
      enabled: true,
      gains: Array(10).fill(3),
      preamp: 5,
    }));
    await controller.flush();
    read.resolve({ ...state(), status: "output-unavailable" });
    await polling;
    expect(controller.snapshot().draft.preamp).toBe(5);
    expect(controller.snapshot().state?.config.gains).toEqual(
      Array(10).fill(3),
    );
    expect(controller.snapshot().state?.status).toBe("ready");
  });
  test("final edits survive close/reopen while the first save is delayed", async () => {
    const api = backend(),
      controller = new SoundStateController(api);
    await controller.refresh();
    const first = deferred<SoundState>();
    api.setSound.mockReturnValueOnce(first.promise);
    controller.edit((c) => ({ ...c, preamp: 3 }));
    const saving = controller.flush();
    await Promise.resolve();
    controller.edit((c) => ({
      ...c,
      preamp: 7,
      presetId: "custom",
      gains: Array(10).fill(2),
    }));
    const closing = controller.flush();
    const reopening = controller.refresh();
    // Reopening reads the backend only after its final configuration is saved.
    api.soundCapabilities.mockImplementation(async () =>
      state(api.setSound.mock.calls.at(-1)![0]),
    );
    first.resolve(state({ ...defaultSound(), preamp: 3 }));
    await Promise.all([saving, closing, reopening]);
    expect(api.setSound.mock.calls.map(([c]) => c.preamp)).toEqual([3, 7]);
    expect(controller.snapshot().draft.preamp).toBe(7);
    expect(controller.snapshot().pending).toBe(false);
  });
  test("activation follows a pending edit and stale reads cannot disable the profile", async () => {
    const api = backend(),
      controller = new SoundStateController(api);
    await controller.refresh();
    const oldRead = deferred<SoundState>();
    api.soundCapabilities.mockReturnValueOnce(oldRead.promise);
    const polling = controller.refresh();
    await Promise.resolve();
    controller.edit((c) => ({ ...c, preamp: 4 }));
    api.soundAction.mockImplementation(async () =>
      state({
        ...api.setSound.mock.calls.at(-1)![0],
        personalEnabled: true,
        profileId: "ears",
      }),
    );
    await controller.action({
      op: "profile-use",
      id: "ears",
      routeGeneration: 0,
    });
    oldRead.resolve(state());
    await polling;
    expect(controller.snapshot().draft).toMatchObject({
      preamp: 4,
      personalEnabled: true,
      profileId: "ears",
    });
  });
  test("a failed final save rolls back to the last acknowledgement", async () => {
    const api = backend(),
      controller = new SoundStateController(api);
    await controller.refresh();
    controller.edit((c) => ({ ...c, preamp: 2 }));
    await controller.flush();
    api.setSound.mockRejectedValueOnce(new Error("Save failed"));
    controller.edit((c) => ({ ...c, preamp: 12 }));
    await controller.flush();
    expect(controller.snapshot().draft.preamp).toBe(2);
    expect(controller.snapshot().error).toContain("Save failed");
    expect(controller.snapshot().pending).toBe(false);
  });
  test("closing during bypass activation queues its reversal", async () => {
    const api = backend(),
      controller = new SoundStateController(api);
    await controller.refresh();
    const activation = deferred<SoundState>();
    api.soundAction.mockReturnValueOnce(activation.promise);
    const applying = controller.action({ op: "bypass", value: true });
    controller.clearBypass();
    activation.resolve({ ...state(), bypass: true });
    await applying;
    await controller.flush();
    expect(api.soundAction.mock.calls).toEqual([
      [{ op: "bypass", value: true }],
      [{ op: "bypass", value: false }],
    ]);
    expect(controller.snapshot().state?.bypass).toBe(false);
  });
});
