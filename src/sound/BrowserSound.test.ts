import { expect, test, vi } from "vitest";
import { BrowserSound } from "./BrowserSound";
import { defaultSound } from "./model";

test("a failed migration stays inactive, reports its error and can be retried", async () => {
  let stored: unknown = {
    ...defaultSound(),
    version: 1,
    profiles: "malformed",
    personalEnabled: true,
  };
  const write = vi.fn(async (config) => {
    stored = config;
  });
  write.mockRejectedValueOnce(new Error("Migration write blocked"));
  const engine = new BrowserSound(
    { paused: true } as HTMLAudioElement,
    async () => stored,
    write,
  );
  const failed = await engine.state();
  expect(failed.status).toBe("failed");
  expect(failed.reason).toContain("Migration write blocked");
  expect((stored as any).version).toBe(1);
  await engine.activate();
  expect(write).toHaveBeenCalledTimes(1);
  const recovered = await engine.action({ op: "retry" });
  expect(recovered.status).toBe("ready");
  expect(stored).toEqual(defaultSound());
  expect("personal" in engine).toBe(false);
  await expect(engine.action({ op: "profile-use" } as never)).rejects.toThrow(
    "Unknown sound action",
  );
  expect(stored).toEqual(defaultSound());
});
