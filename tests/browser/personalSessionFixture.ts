import type { Page } from "@playwright/test";
import { defaultSound } from "../../src/sound/model";

/** Delayed native IPC fixture; it does not play or validate native audio. */
export async function holdRepeatingTone(page: Page) {
  await page.addInitScript((config) => {
    const fixture = window as any;
    fixture.isTauri = true;
    const session = {
      id: "delayed-tone",
      trialId: "trial-0",
      answeredTrials: 0,
      totalTrials: 36,
      estimates: Array.from({ length: 12 }, (_, i) => ({
        ear: Math.floor(i / 6),
        frequency: [1000, 250, 500, 2000, 4000, 8000][i % 6],
        status: "untested",
        estimateDbfs: null,
        lowerDbfs: null,
        upperDbfs: null,
        answered: 0,
      })),
      phase: "test",
      ear: 0,
      step: 0,
      frequency: 1000,
      level: -54,
      awaiting: false,
      busyUntil: 0,
      message: "",
      strength: 100,
      left: Array(10).fill(0),
      right: Array(10).fill(0),
    };
    let pulses = 0;
    fixture.responses = [];
    fixture.repeatHeld = false;
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
            return {
              supported: true,
              systemPanel: false,
              config,
              status: "ready",
              sampleRate: 48000,
              channels: 2,
              attenuation: 0,
              bypass: false,
              inactiveBands: [],
              personalAvailable: true,
              routeMonitoring: true,
            };
          case "personal_action": {
            const a = args.action;
            if (a.op === "pulse") {
              if (++pulses === 2) {
                fixture.repeatHeld = true;
                await new Promise<void>((resolve) => {
                  fixture.releaseTone = resolve;
                });
              }
              session.awaiting = true;
              session.busyUntil = Date.now() + 50;
            } else if (a.op === "respond") {
              fixture.responses.push(a.heard);
              session.awaiting = false;
              session.answeredTrials++;
              session.trialId = "trial-1";
              session.ear = 1;
              session.estimates[0] = {
                ...session.estimates[0],
                status: "estimating",
                estimateDbfs: a.heard ? -66 : -42,
                lowerDbfs: a.heard ? null : -54,
                upperDbfs: a.heard ? -54 : null,
                answered: 1,
              };
            } else if (a.op === "cancel") session.phase = "cancelled";
            return structuredClone(session);
          }
          default:
            return null;
        }
      },
    };
    fixture.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, defaultSound());
}
