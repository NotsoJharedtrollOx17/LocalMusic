import { test, expect, type Page } from "@playwright/test";
import { defaultSound } from "../../src/sound/model";
async function openSound(page: Page) {
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: "Settings", exact: true })
    .getByRole("button", { name: "Sound controls", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Sound controls", exact: true });
}
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
test("sound settings work before playback and custom presets persist in narrow dark Spanish UI", async ({
  page,
}) => {
  await page.goto("/");
  let sound = await openSound(page);
  await expect(sound).toContainText("Ready for playback");
  await expect(sound.getByRole("slider")).toHaveCount(11);
  await expect(sound.getByRole("combobox")).toHaveCount(0);
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  await expect(
    sound.getByRole("checkbox", { name: "Enable equalizer" }),
  ).toBeChecked();
  const band = sound.getByRole("slider", { name: "1000 Hz gain", exact: true });
  await band.focus();
  await page.keyboard.press("End");
  await expect(band).toHaveValue("12");
  await sound
    .getByRole("button", { name: "Save as preset", exact: true })
    .click();
  await sound
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("My headphones with a sufficiently long but readable name");
  await sound.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    sound.getByRole("button", { name: "Save as preset", exact: true }),
  ).toBeFocused();
  await expect
    .poll(async () => (await preferences(page))?.presets.length)
    .toBe(1);
  await page.reload();
  sound = await openSound(page);
  await expect(
    sound.getByRole("slider", { name: "1000 Hz gain", exact: true }),
  ).toHaveValue("12");
  await expect(
    sound.getByRole("button", { name: /My headphones/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await sound.getByRole("button", { name: "Rename", exact: true }).click();
  await sound
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Headphones");
  await sound.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    sound.getByRole("button", { name: "Rename", exact: true }),
  ).toBeFocused();
  await expect(
    sound.getByRole("button", { name: "Headphones", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("button", { name: "Dark", exact: true }).click();
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Controles de sonido", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Headphones", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/sound-mobile-dark.png" });
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
  await sound.getByRole("checkbox", { name: "Enable equalizer" }).check();
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
  await sound.getByRole("button", { name: "Bypass all", exact: true }).click();
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
      presetId: "rock",
      gains: [3, 2, 1, -1, -2, -1, 1, 2, 3, 2],
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
  const personalSound = await openSound(page);
  await personalSound
    .getByRole("button", { name: "Measured fixture", exact: true })
    .click();
  await expect(
    personalSound.getByRole("slider", { name: "Strength", exact: true }),
  ).toHaveCount(0);
  await expect.poll(async () => (await preferences(page))?.strength).toBe(100);
  const preamp = personalSound.getByRole("slider", {
    name: "Preamp",
    exact: true,
  });
  await expect(preamp).toHaveCSS("writing-mode", "vertical-lr");
  await expect(
    preamp.locator(
      "xpath=ancestor::*[contains(@class, 'personal-stereo-bands')]",
    ),
  ).toHaveCount(1);
  await page.screenshot({
    path: "artifacts/sound-personal-preamp-desktop.png",
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
  await page.goto("/");
  const sound = await openSound(page);
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(sound.getByRole("slider")).toHaveCount(11);
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  for (let i = 0; i < 14; i++) {
    const play = sound.getByRole("button", { name: "Play tone", exact: true });
    await expect(play).toBeEnabled();
    await play.click();
    const heard = sound.getByRole("button", { name: "Heard it", exact: true });
    await expect(heard).toBeEnabled();
    await heard.click();
  }
  await expect(sound).toContainText("Compare your sound");
  await expect(
    sound.getByRole("slider", { name: "Strength", exact: true }),
  ).toHaveCount(0);
  await sound.getByRole("button", { name: "Personal", exact: true }).click();
  await sound
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Personal headphones");
  await sound
    .getByRole("button", { name: "Save profile", exact: true })
    .click();
  await expect(sound).toContainText("Profile saved as your default sound");
  await sound.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    sound.getByRole("button", { name: "Disable profile", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await preferences(page))?.personalEnabled)
    .toBe(true);
  await page.reload();
  const restored = await openSound(page);
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
  await sound.getByRole("button", { name: "Play tone", exact: true }).click();
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
  const sound = await openSound(page);
  await expect(sound.getByRole("slider")).toHaveCount(11);
  await expect(
    sound.getByRole("button", { name: "Create personal profile", exact: true }),
  ).toBeDisabled();
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  await expect(
    sound.getByRole("checkbox", { name: "Enable equalizer" }),
  ).toBeChecked();
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
  await expect(sound.getByRole("slider")).toHaveCount(11);
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  await expect(
    sound.getByRole("checkbox", { name: "Enable equalizer" }),
  ).toBeChecked();
  await sound
    .getByRole("button", { name: "Retry audio output", exact: true })
    .click();
  await expect(sound).toContainText("Ready for playback");
  await expect(
    sound.getByRole("button", { name: "Rock", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("presets preserve independent positive preamp and reset restores zero", async ({
  page,
}) => {
  await page.goto("/");
  const sound = await openSound(page);
  const preamp = sound.getByRole("slider", { name: "Preamp", exact: true });
  await expect(preamp).toHaveCSS("writing-mode", "vertical-lr");
  await expect(
    preamp.locator("xpath=ancestor::*[contains(@class, 'equalizer-bands')]"),
  ).toHaveCount(1);
  await preamp.focus();
  await page.keyboard.press("End");
  await expect(preamp).toHaveValue("12");
  for (const name of ["Treble boost", "Rock", "Flat"]) {
    await sound.getByRole("button", { name, exact: true }).click();
    await expect(preamp).toHaveValue("12");
  }
  await sound.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(preamp).toHaveValue("12");
  await expect(preamp).toHaveAttribute("aria-valuetext", "+12.0 dB");
  await sound
    .getByRole("button", { name: "Save as preset", exact: true })
    .click();
  await sound
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Independent EQ");
  await sound.getByRole("button", { name: "Save", exact: true }).click();
  await sound
    .getByRole("button", { name: "Reset Preamp", exact: true })
    .click();
  await sound
    .getByRole("button", { name: "Independent EQ", exact: true })
    .click();
  await expect(preamp).toHaveValue("0");
  await preamp.focus();
  await page.keyboard.press("End");
  await expect(
    sound.getByRole("button", { name: "Independent EQ", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await preferences(page))?.preamp).toBe(12);
  await page.reload();
  const again = await openSound(page);
  await expect(
    again.getByRole("slider", { name: "Preamp", exact: true }),
  ).toHaveValue("12");
  await again
    .getByRole("button", { name: "Reset Preamp", exact: true })
    .click();
  await expect(
    again.getByRole("slider", { name: "Preamp", exact: true }),
  ).toHaveValue("0");
  await expect.poll(async () => (await preferences(page))?.preamp).toBe(0);
});

test("Not heard replays a bounded higher tone and interrupted setup offers restart", async ({
  page,
}) => {
  await page.goto("/");
  const sound = await openSound(page);
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  await sound.getByRole("button", { name: "Play tone", exact: true }).click();
  const missed = sound.getByRole("button", { name: "Not heard", exact: true });
  await expect(missed).toBeEnabled();
  await missed.click();
  await expect(sound).toContainText("-48 dBFS");
  await expect(missed).toBeEnabled();
  await sound.getByRole("button", { name: "Heard it", exact: true }).click();
  await expect(sound).toContainText("250 Hz");
  await expect(
    sound.getByRole("button", { name: "Play tone", exact: true }),
  ).toBeEnabled();
  await sound.getByRole("button", { name: "Play tone", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await expect(missed).toBeEnabled();
    await missed.click();
  }
  await expect(
    sound.getByRole("button", { name: "Heard it", exact: true }),
  ).toBeEnabled();
  await sound.getByRole("button", { name: "Heard it", exact: true }).click();
  await expect(
    sound.getByRole("slider", { name: "250 Hz gain Left", exact: true }),
  ).toHaveValue("6");
  await expect(sound).toContainText("Provisional curve");
  await expect(
    sound.getByRole("button", { name: "Play tone", exact: true }),
  ).toBeEnabled();
  await sound.getByRole("button", { name: "Play tone", exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await expect(missed).toBeEnabled();
    await missed.click();
  }
  await expect(sound).toContainText("2 kHz");
  await expect(
    sound.getByRole("slider", { name: "1000 Hz gain Left", exact: true }),
  ).toHaveValue("0");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(sound).toContainText("No partial profile was saved");
  await sound
    .getByRole("button", { name: "Restart setup", exact: true })
    .click();
  await expect(
    sound.getByRole("button", { name: "Begin", exact: true }),
  ).toBeDisabled();
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(sound).toContainText("Step 1/14");
});
