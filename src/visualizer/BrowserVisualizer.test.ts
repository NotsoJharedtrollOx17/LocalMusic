import { it, expect, vi, afterEach } from "vitest";
import { BrowserVisualizer } from "./BrowserVisualizer";
import type { BrowserSound } from "../sound/BrowserSound";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("sessions expire, old stop is harmless, and worker failure never calls playback", () => {
  vi.useFakeTimers();
  const workers: any[] = [];
  vi.stubGlobal(
    "Worker",
    class {
      onerror?: () => void;
      onmessage?: () => void;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() {
        workers.push(this);
      }
    },
  );
  const audio = Object.assign(new EventTarget(), {
    paused: false,
    readyState: 4,
    currentTime: 1,
  });
  const post = vi.fn(),
    output = {
      node: { port: { postMessage: post } },
      context: { currentTime: 1, sampleRate: 48000 },
    };
  const sound = { visualizerOutput: () => output } as unknown as BrowserSound;
  const visual = new BrowserVisualizer(
      audio as unknown as HTMLAudioElement,
      sound,
    ),
    old = visual.start(),
    current = visual.start();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  visual.stop(old.id);
  expect(workers[1].terminate).not.toHaveBeenCalled();
  expect(() => visual.read(old.id)).toThrow();
  expect(visual.read(current.id)).toBeNull();
  workers[1].onerror();
  expect(() => visual.read(current.id)).toThrow("Audio analysis unavailable");
  visual.stop(current.id);
  const next = visual.start();
  vi.advanceTimersByTime(3001);
  expect(() => visual.read(next.id)).toThrow("Expired");
  expect(workers[2].terminate).toHaveBeenCalledOnce();
});
