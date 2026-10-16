import calibrationFixtures from "../fixtures/sound-calibration.json" with { type: "json" };
import { test, expect, type Page } from "@playwright/test";
import { defaultSound } from "../../src/sound/model";
import {
  openSound,
  openSettings,
  switchSound,
  closeSound,
} from "./navigationHelpers";
async function preferences(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const open = indexedDB.open("local-music-v1", 1);
        open.onsuccess = () => {
          const db = open.result;
          const request = db
            .transaction("settings")
            .objectStore("settings")
            .get("sound-v1");
          request.onsuccess = () => {
            resolve(request.result);
            db.close();
          };
          request.onerror = () => reject(request.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
}
test("Normal and automatic Custom persist in narrow dark Spanish UI", async ({
  page,
}) => {
  await page.goto("/");
  let sound = await openSound(page);
  await expect(sound.locator(".sound-status")).toHaveClass(/sound-sr-only/);
  await expect(sound.getByRole("slider")).toHaveCount(9);
  await expect(sound.getByRole("switch")).toHaveCount(0);
  await expect(
    sound.getByRole("slider", { name: "Preamp", exact: true }),
  ).toHaveCount(0);
  for (const name of [
    "Bass boost",
    "Treble boost",
    "Voice",
    "Save as preset",
    "Reset",
  ])
    await expect(sound.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await expect(
    sound.getByRole("button", { name: "Normal", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const labels = await sound
    .getByRole("slider")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
  expect(labels).toEqual(
    [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map(
      (f) => `${f} Hz gain`,
    ),
  );
  const band = sound.getByRole("slider", { name: "1000 Hz gain", exact: true });
  await band.focus();
  await page.keyboard.press("End");
  await expect(band).toHaveValue("10");
  await expect(
    sound.getByRole("button", { name: "Custom", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(
      async () =>
        (await preferences(page))?.presets.find((p: any) => p.id === "custom")
          ?.gains[5],
    )
    .toBe(10);
  await sound.getByRole("button", { name: "Normal", exact: true }).click();
  expect(
    await sound
      .getByRole("slider")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value)),
  ).toEqual(Array(9).fill("0"));
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  await sound.getByRole("button", { name: "Custom", exact: true }).click();
  await expect(band).toHaveValue("10");
  await band.focus();
  await page.keyboard.press("Home");
  await expect(band).toHaveValue("-10");
  await expect.poll(async () => (await preferences(page))?.gains[5]).toBe(-10);
  await page.reload();
  sound = await openSound(page);
  await expect(
    sound.getByRole("slider", { name: "1000 Hz gain", exact: true }),
  ).toHaveValue("-10");
  await expect.poll(async () => (await preferences(page))?.enabled).toBe(true);
  expect((await preferences(page)).preamp).toBe(0);
  await closeSound(page);
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Dark", exact: true }).click();
  await settings
    .getByRole("button", { name: "Espa\u00f1ol", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Escape");
  sound = await openSound(page);
  await expect(
    sound.getByRole("button", { name: "Personalizado", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    sound.getByRole("slider", { name: "1000 Hz ganancia", exact: true }),
  ).toHaveValue("-10");
  await expect(sound.getByRole("slider").first()).toHaveCSS(
    "writing-mode",
    "vertical-lr",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/eq-simplified-mobile-dark-es.png" });
});

test("library playback runs through the real AudioWorklet and band edits change spectral balance", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = AudioWorkletNode;
    class Captured extends Original {
      constructor(
        context: BaseAudioContext,
        name: string,
        options?: AudioWorkletNodeOptions,
      ) {
        super(context, name, options);
        const analyser = context.createAnalyser();
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0;
        this.connect(analyser);
        (window as any).__soundAnalyser = analyser;
        (window as any).__soundRate = context.sampleRate;
        (window as any).__soundWorklet = this;
        const splitter = context.createChannelSplitter(2);
        this.connect(splitter);
        (window as any).__ears = [0, 1].map((ch) => {
          const a = context.createAnalyser();
          a.fftSize = 8192;
          a.smoothingTimeConstant = 0;
          splitter.connect(a, ch);
          return a;
        });
      }
    }
    (window as any).AudioWorkletNode = Captured;
  });
  await page.goto("/");
  const rate = 48000,
    n = rate * 40,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF");
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(
      Math.round(
        1500 *
          (Math.sin((2 * Math.PI * 250 * i) / rate) +
            Math.sin((2 * Math.PI * 1000 * i) / rate)),
      ),
      44 + i * 2,
    );
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "Spectral fixture.wav",
    mimeType: "audio/wav",
    buffer: b,
  });
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page
    .locator(".track-row")
    .getByRole("button", { name: /Play/ })
    .first()
    .click();
  const measure = () =>
    page.evaluate(() => {
      const analyser = (window as any).__soundAnalyser as AnalyserNode;
      if (!analyser) return null;
      const data = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(data);
      const bin = (f: number) =>
        Math.round((f * analyser.fftSize) / (window as any).__soundRate);
      return data[bin(1000)] - data[bin(250)];
    });
  await expect.poll(measure).not.toBeNull();
  await expect
    .poll(async () => Math.abs((await measure()) ?? 100))
    .toBeLessThan(0.5);
  const bandLevel = (frequency: number, ear?: number) =>
    page.evaluate(
      ({ frequency, ear }) => {
        const a = (
          ear === undefined
            ? (window as any).__soundAnalyser
            : (window as any).__ears?.[ear]
        ) as AnalyserNode;
        if (!a) return -100;
        const d = new Float32Array(a.frequencyBinCount);
        a.getFloatFrequencyData(d);
        return d[
          Math.round((frequency * a.fftSize) / (window as any).__soundRate)
        ];
      },
      { frequency, ear },
    );
  const unaffectedLevel = await bandLevel(250);
  const before = (await measure())!;
  const sound = await openSound(page);
  await sound.getByRole("button", { name: "Normal", exact: true }).click();
  const band = sound.getByRole("slider", { name: "1000 Hz gain", exact: true });
  await band.focus();
  await page.keyboard.press("End");
  await expect
    .poll(async () => ((await measure()) ?? 0) - before)
    .toBeGreaterThan(8);
  await expect
    .poll(async () => (await bandLevel(250)) - unaffectedLevel)
    .toBeGreaterThan(-0.5);
  await expect(sound).not.toContainText("Automatic EQ headroom");
  await expect(sound).toContainText("Processing active");
  await expect(
    sound.getByRole("button", { name: "Bypass all", exact: true }),
  ).toHaveCount(0);
  await sound.getByRole("button", { name: "Normal", exact: true }).click();
  await expect
    .poll(async () => Math.abs(((await measure()) ?? 100) - before))
    .toBeLessThan(2);
  await page.screenshot({ path: "artifacts/sound-desktop.png" });
  await page.evaluate(() =>
    (window as any).__soundWorklet.dispatchEvent(new Event("processorerror")),
  );
  await expect(sound).toContainText("Sound processing failed");
  await expect(sound).toContainText("Ordinary playback remains available");
  await sound
    .getByRole("button", { name: "Retry audio output", exact: true })
    .click();
  await expect(sound).not.toContainText("Sound processing failed");
  await expect
    .poll(async () => Math.abs(((await measure()) ?? 100) - before))
    .toBeLessThan(2);
  await page.evaluate(
    async (config) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("local-music-v1", 1);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("settings", "readwrite");
          tx.objectStore("settings").put(config, "sound-v1");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    {
      ...defaultSound(),
      enabled: false,
      presetId: "flat",
      gains: Array(10).fill(0),
      profileId: "fixture",
      strength: 50,
      profiles: [
        {
          id: "fixture",
          name: "Measured fixture",
          left: [0, 0, 0, 6, 0, 0, 0, 0, 0, 0],
          right: Array(10).fill(0),
          complete: Array(12).fill(true),
        },
      ],
    },
  );
  await page.reload();
  await page
    .locator(".track-row")
    .getByRole("button", { name: /Play/ })
    .first()
    .click();
  let personalSound = await openSound(page, "adapt");
  await personalSound
    .getByRole("button", { name: "Measured fixture", exact: true })
    .click();
  await expect(
    personalSound.getByRole("slider", { name: "Strength", exact: true }),
  ).toHaveCount(0);
  await expect.poll(async () => (await preferences(page))?.strength).toBe(100);
  await expect(
    personalSound.getByRole("slider", { name: "Preamp", exact: true }),
  ).toHaveCount(0);
  await expect(personalSound.getByRole("slider")).toHaveCount(18);
  await page.screenshot({
    path: "artifacts/sound-personal-nine-band-desktop.png",
  });
  await expect(
    personalSound.getByRole("button", { name: /^(Left ear|Right ear)$/ }),
  ).toHaveCount(0);
  await expect(
    personalSound.getByRole("slider", {
      name: "250 Hz gain Left",
      exact: true,
    }),
  ).toHaveValue("6");
  await expect(
    personalSound.getByRole("slider", {
      name: "250 Hz gain Right",
      exact: true,
    }),
  ).toHaveValue("0");
  personalSound = await switchSound(page, "equalizer");
  await personalSound.locator("summary").click();
  await expect(
    personalSound.getByRole("button", { name: "Rock", exact: true }),
  ).toBeDisabled();
  const balance = (ear: number) =>
    page.evaluate((ear) => {
      const a = (window as any).__ears?.[ear] as AnalyserNode;
      if (!a) return -100;
      const d = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(d);
      const bin = (f: number) =>
        Math.round((f * a.fftSize) / (window as any).__soundRate);
      return d[bin(250)] - d[bin(1000)];
    }, ear);
  await expect
    .poll(async () => (await balance(0)) - (await balance(1)))
    .toBeGreaterThan(5);
  await expect(
    personalSound.getByRole("slider", {
      name: "250 Hz gain Left",
      exact: true,
    }),
  ).toHaveValue("6");
  await expect(
    personalSound.getByRole("slider", {
      name: "250 Hz gain Right",
      exact: true,
    }),
  ).toHaveValue("0");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/personal-stereo-mobile.png" });
  const personalRightLevel = await bandLevel(1000, 1);
  await personalSound
    .getByRole("button", { name: "Disable profile", exact: true })
    .click();
  await expect(
    personalSound.getByRole("button", { name: "Rock", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(async () => Math.abs((await balance(0)) - (await balance(1))))
    .toBeLessThan(1);
  await expect
    .poll(async () => Math.abs((await bandLevel(1000, 1)) - personalRightLevel))
    .toBeLessThan(1);
  await expect.poll(async () => (await preferences(page))?.preamp).toBe(0);
});
test("personal setup saves an active default, persists on restart, cancels on blur and creates no listening history", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = Worker;
    (window as any).comparisonWorkerCount = 0;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes("comparison.worker"))
          (window as any).comparisonWorkerCount++;
      }
    };
  });
  await page.goto("/");
  const sound = await openSound(page, "adapt");
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(sound.getByRole("slider")).toHaveCount(0);
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  test.setTimeout(240000);
  const calibration = calibrationFixtures.sessions[3];
  for (let i = 0; i < 36; i++) {
    const answer = sound.getByRole("button", {
      name: calibration.answers[i] ? "Heard it" : "Not heard",
      exact: true,
    });
    await expect(answer).toBeEnabled();
    await answer.click();
    if (i < 35)
      await expect(sound.getByRole("progressbar")).toHaveAttribute(
        "value",
        String(i + 1),
      );
    else await expect(sound).toContainText("Compare your sound");
  }
  await expect(sound).toContainText("Compare your sound");
  await page.setViewportSize({ width: 390, height: 700 });
  await page.screenshot({
    path: "artifacts/adapt-review/comparison-mobile.png",
  });
  await expect(
    sound.getByRole("slider", { name: "Strength", exact: true }),
  ).toHaveCount(0);
  await sound.getByRole("button", { name: "Personal", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).comparisonWorkerCount))
    .toBe(1);
  await expect(
    sound.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await expect(sound.getByRole("alert")).toHaveCount(0);
  await sound
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Personal headphones");
  await sound
    .getByRole("button", { name: "Save profile", exact: true })
    .click();
  await expect(sound).toContainText("Profile saved as your default sound");
  await page.screenshot({ path: "artifacts/adapt-review/saved-mobile.png" });
  await sound.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    sound.getByRole("button", { name: "Disable profile", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await preferences(page))?.personalEnabled)
    .toBe(true);
  const savedConfig = await preferences(page);
  const saved = savedConfig.profiles.find(
    (p: any) => p.id === savedConfig.profileId,
  );
  expect(saved.left).toEqual(calibration.left);
  expect(saved.right).toEqual(calibration.right);
  expect(saved.calibration).toEqual({
    method: "bounded-3-v1",
    coverage: calibration.coverage,
  });
  await page.reload();
  const restored = await openSound(page, "adapt");
  await expect(
    restored.getByRole("button", { name: "Disable profile", exact: true }),
  ).toBeVisible();
  await expect(
    restored.getByRole("slider", { name: "250 Hz gain Left", exact: true }),
  ).toBeVisible();
  await expect(
    restored.getByRole("slider", { name: "250 Hz gain Right", exact: true }),
  ).toBeVisible();
  await sound
    .getByRole("button", { name: "Manage profile", exact: true })
    .click();
  await sound
    .getByRole("menuitem", { name: "Retest profile", exact: true })
    .click();
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(
    sound.getByRole("button", { name: "Done", exact: true }),
  ).toBeVisible();
  const counts = await page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const open = indexedDB.open("local-music-v1", 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction(["sessions", "intervals"]),
            a = tx.objectStore("sessions").count(),
            b = tx.objectStore("intervals").count();
          tx.oncomplete = () => {
            resolve([a.result, b.result]);
            db.close();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  expect(counts).toEqual([0, 0]);
});
test("multichannel imports retain their processor channels and disable personal setup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = AudioWorkletNode;
    class Captured extends Original {
      constructor(
        context: BaseAudioContext,
        name: string,
        options?: AudioWorkletNodeOptions,
      ) {
        super(context, name, options);
        (window as any).__soundOutputChannels =
          options?.outputChannelCount?.[0];
      }
    }
    (window as any).AudioWorkletNode = Captured;
  });
  await page.goto("/");
  const channels = 6,
    rate = 48000,
    frames = rate * 2;
  const wav = Buffer.alloc(44 + frames * channels * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "Six channels.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page
    .locator(".track-row")
    .getByRole("button", { name: /Play/ })
    .first()
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__soundOutputChannels))
    .toBe(6);
  let sound = await openSound(page, "adapt");
  await expect(sound.getByRole("slider")).toHaveCount(0);
  await expect(
    sound.getByRole("button", { name: "Create personal profile", exact: true }),
  ).toBeDisabled();
  sound = await switchSound(page, "equalizer");
  await expect(sound.getByRole("slider")).toHaveCount(9);
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  await expect(
    sound.getByRole("button", { name: "Rock", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("missing native output keeps configuration editable and Retry updates runtime status", async ({
  page,
}) => {
  await page.addInitScript((config) => {
    const fixture = window as any;
    fixture.isTauri = true;
    let state: any = {
      supported: true,
      systemPanel: false,
      config,
      status: "output-unavailable",
      sampleRate: 48000,
      channels: 2,
      attenuation: 0,
      bypass: false,
      inactiveBands: [],
      personalAvailable: true,
      routeMonitoring: true,
    };
    fixture.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      invoke: async (command: string, args: any) => {
        switch (command) {
          case "get_settings":
            return {
              language: "en",
              theme: "light",
              timeZone: "America/Los_Angeles",
              historyEnabledSince: new Date().toISOString(),
            };
          case "playback_snapshot":
            return {
              playing: false,
              queue: [],
              queueIndex: 0,
              positionMs: 0,
              durationMs: 0,
              shuffle: false,
              repeat: "off",
              excluded: false,
            };
          case "list_tracks":
            return { tracks: [], total: 0 };
          case "list_playlists":
          case "tracks_by_id":
            return [];
          case "sound_capabilities":
            return state;
          case "set_sound":
            state = { ...state, config: args.config };
            return state;
          case "sound_action":
            state = { ...state, status: "ready" };
            return state;
          default:
            return null;
        }
      },
    };
    fixture.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, defaultSound());
  await page.goto("/");
  const sound = await openSound(page);
  await expect(sound).toContainText(
    "Audio output unavailable. Your settings are saved.",
  );
  await expect(sound.getByRole("slider")).toHaveCount(9);
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  await expect(
    sound.getByRole("button", { name: "Rock", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await sound
    .getByRole("button", { name: "Retry audio output", exact: true })
    .click();
  await expect(sound.locator(".sound-status")).toHaveClass(/sound-sr-only/);
  await expect(
    sound.getByRole("button", { name: "Rock", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("legacy disabled EQ and manual gain migrate without losing archived curves", async ({
  page,
}) => {
  await page.goto("/");
  const legacy = {
    ...defaultSound(),
    enabled: false,
    preamp: -8,
    presetId: "user-old",
    gains: [12, -12, 12, 0, 0, 0, 0, 0, 0, 0],
    presets: [
      {
        id: "user-old",
        name: "Old custom headphones",
        gains: [12, -12, 12, 0, 0, 0, 0, 0, 0, 0],
        preamp: -8,
      },
    ],
  };
  await page.evaluate(
    (config) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.open("local-music-v1", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("settings", "readwrite");
          tx.objectStore("settings").put(config, "sound-v1");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
    legacy,
  );
  await page.reload();
  const sound = await openSound(page);
  await expect(
    sound.getByRole("button", { name: "Custom", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    sound.getByRole("slider", { name: "63 Hz gain", exact: true }),
  ).toHaveValue("-10");
  await expect(
    sound.getByRole("slider", { name: "125 Hz gain", exact: true }),
  ).toHaveValue("10");
  const saved = await preferences(page);
  expect(saved.enabled).toBe(true);
  expect(saved.preamp).toBe(0);
  expect(saved.gains[0]).toBe(0);
  expect(saved.presets.find((p: any) => p.id === "user-old")).toEqual(
    legacy.presets[0],
  );
  await expect(
    sound.getByRole("button", { name: "Old custom headphones", exact: true }),
  ).toHaveCount(0);
});

test("answers refine both diagrams and alternate ears before switching frequency", async ({
  page,
}) => {
  await page.goto("/");
  const sound = await openSound(page, "adapt");
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  const left = sound
    .locator(".setup-channel")
    .first()
    .locator('[data-frequency="1000"]');
  const right = sound
    .locator(".setup-channel")
    .last()
    .locator('[data-frequency="1000"]');
  const initialHeight = await left
    .locator("span")
    .first()
    .evaluate((node) => node.getBoundingClientRect().height);
  const originalBand = await left.elementHandle();
  const answer = async (heard: boolean) => {
    const button = sound.getByRole("button", {
      name: heard ? "Heard it" : "Not heard",
      exact: true,
    });
    await expect(button).toBeEnabled();
    await button.click();
  };
  await answer(true);
  await expect(left).toHaveAttribute("data-estimate", "-66");
  expect(await originalBand!.evaluate((node) => node.isConnected)).toBe(true);
  await expect
    .poll(() =>
      left
        .locator("span")
        .first()
        .evaluate((node) => node.getBoundingClientRect().height),
    )
    .toBeGreaterThan(initialHeight + 10);
  await expect(right).toHaveAttribute("data-status", "untested");
  await answer(false);
  await expect(right).toHaveAttribute("data-estimate", "-42");
  await sound.getByText("Tone details", { exact: true }).click();
  await expect(sound).toContainText("-66 dBFS");
  await answer(false);
  await expect(left).toHaveAttribute("data-estimate", "-60");
  await answer(true);
  await expect(right).toHaveAttribute("data-estimate", "-48");
  await answer(true);
  await expect(left).toHaveAttribute("data-status", "bracketed");
  await expect(left).toHaveAttribute("data-estimate", "-63");
  await answer(false);
  await expect(right).toHaveAttribute("data-status", "bracketed");
  await expect(right).toHaveAttribute("data-estimate", "-45");
  await expect(sound).toContainText("250 Hz");
  await expect(sound).toContainText("Step 7/36");
  await page.screenshot({
    path: "artifacts/adapt-review/adaptive-six-answers.png",
  });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(sound).toContainText("No partial profile was saved");
  await sound
    .getByRole("button", { name: "Restart setup", exact: true })
    .click();
  await expect(
    sound.getByRole("button", { name: "Begin", exact: true }),
  ).toBeDisabled();
});

test("compact EQ scale aligns at desktop, mobile and zoom-sized widths", async ({
  page,
}) => {
  await page.goto("/");
  const sound = await openSound(page);
  await expect(sound.locator(".sound-presets legend")).toHaveCount(0);
  await expect(sound.locator(".sound-save-state")).toHaveCount(0);
  for (const width of [1280, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const grid = sound.locator(".equalizer-grid");
    await expect(grid.locator(".equalizer-level")).toHaveCount(11);
    await expect(grid.locator(".equalizer-level > span")).toHaveText([
      "+10 dB",
      "0 dB",
      "\u221210 dB",
    ]);
    const geometry = await grid.evaluate((root) => {
      const sliders = [...root.querySelectorAll("input")].map((n) =>
        n.getBoundingClientRect(),
      );
      const levels = [...root.querySelectorAll(".equalizer-level")].map(
        (n) => n.getBoundingClientRect().y,
      );
      const labels = [...root.querySelectorAll(".equalizer-band > span")].map(
        (n) => n.getBoundingClientRect(),
      );
      return {
        tops: sliders.map((r) => r.y),
        heights: sliders.map((r) => r.height),
        centers: sliders.map((r) => r.x + r.width / 2),
        top: levels[0] - sliders[0].y,
        middle: levels[5] - sliders[0].y,
        bottom: levels[10] - sliders[0].y,
        labelsSeparated: labels.every(
          (r, i) => i === 0 || labels[i - 1].right <= r.left,
        ),
      };
    });
    expect(new Set(geometry.tops).size).toBe(1);
    expect(geometry.heights).toEqual(Array(9).fill(180));
    expect(geometry.top).toBeCloseTo(8, 0);
    expect(geometry.middle).toBeCloseTo(90, 0);
    expect(geometry.bottom).toBeCloseTo(172, 0);
    expect(geometry.labelsSeparated).toBe(true);
    expect(
      geometry.centers.every(
        (x, i) => i === 0 || x - geometry.centers[i - 1] >= 20,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `artifacts/eq-grid-${width}.png` });
  }
});
