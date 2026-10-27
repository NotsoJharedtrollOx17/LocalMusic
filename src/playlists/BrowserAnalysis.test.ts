import { afterEach, describe, it, expect, vi } from "vitest";
import { BrowserAnalysis, type AnalysisTrack } from "./BrowserAnalysis";
const track = (): AnalysisTrack => ({
  id: "a",
  sourceUri: "fixture",
  durationMs: 1000,
  audioChannels: 1,
  file: new Blob([new Uint8Array(32)]),
});
afterEach(() => vi.unstubAllGlobals());
describe("idle source decode cancellation and guards", () => {
  it("rejects unbounded sources before any decode", async () => {
    vi.stubGlobal("document", { hidden: false });
    vi.stubGlobal("window", globalThis);
    const decode = vi.fn();
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        decodeAudioData = decode;
      },
    );
    const scan = new BrowserAnalysis(() => false);
    scan.activity(true);
    await scan.analyze({ ...track(), durationMs: 3600000 }, vi.fn());
    expect(decode).not.toHaveBeenCalled();
    expect(scan.busy).toBe(false);
  });
  it("a pending non-abortable browser decode cannot publish after pause/visibility lease revocation", async () => {
    vi.stubGlobal("document", { hidden: false });
    vi.stubGlobal("window", globalThis);
    let finish!: (value: unknown) => void;
    const decode = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        decodeAudioData = decode;
      },
    );
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    const save = vi.fn(),
      scan = new BrowserAnalysis(() => false);
    scan.activity(true);
    const pending = scan.analyze(track(), save);
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
    scan.activity(false);
    finish({});
    await pending;
    expect(save).not.toHaveBeenCalled();
    expect(worker).not.toHaveBeenCalled();
    expect(scan.busy).toBe(false);
  });
});
