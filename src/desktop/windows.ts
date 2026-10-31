import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";
export type DetachedView = "player" | "visualizer";
export interface WindowEntry {
  view: DetachedView;
  phase: "opening" | "transferring" | "detached" | "returning";
  generation: number;
  queue: boolean;
  pinned: boolean;
}
export interface WindowState {
  revision?: number;
  supported: boolean;
  windows: WindowEntry[];
  retry?: { op: "open"; view: DetachedView; queue: boolean };
}
export type WindowAction =
  | { op: "appearance"; dark: boolean }
  | { op: "open"; view: DetachedView; queue: boolean }
  | { op: "ready" | "released"; view: DetachedView; generation: number }
  | { op: "return" | "dismiss"; view: DetachedView }
  | { op: "pin"; view: DetachedView; value: boolean }
  | { op: "queue"; value: boolean }
  | {
      op: "navigate";
      kind: "albums" | "artists" | "visualizer";
      trackId: string;
    };
export interface Change {
  source?: string;
  ids?: string[];
  domain:
    "catalog" | "playlists" | "feedback" | "privacy" | "settings" | "sound";
  revision: number;
}
export const companion = isTauri()
  ? new URLSearchParams(location.search).get("companion")
  : null;
export const companionView: DetachedView | null =
  companion === "player" || companion === "visualizer" ? companion : null;
let snapshot: WindowState = { supported: false, windows: [] };
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());
export const desktop = {
  async action(action: WindowAction) {
    try {
      await invoke<void>("desktop_action", { action });
      if (action.op === "open" && snapshot.retry) {
        snapshot = { ...snapshot, retry: undefined };
        notify();
      }
    } catch (error) {
      if (action.op === "open") {
        snapshot = { ...snapshot, retry: action };
        notify();
      }
      throw error;
    }
  },
  entry: (view: DetachedView) => snapshot.windows.find((e) => e.view === view),
  reconcile: () => invoke<WindowState>("desktop_state"),
  async initialize() {
    if (!isTauri()) return;
    let events = 0;
    await listen<WindowEntry[]>("desktop://windows", (e) => {
      events++;
      snapshot = { supported: snapshot.supported, windows: e.payload };
      notify();
    });
    const before = events;
    const initial = await invoke<WindowState>("desktop_state");
    if (!initial) return;
    snapshot = {
      supported: initial.supported,
      windows: events === before ? initial.windows : snapshot.windows,
    };
    notify();
  },
};
export function useDesktopWindows() {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => snapshot,
  );
}
export async function onDesktop<T>(event: string, fn: (value: T) => void) {
  return listen<T>(`desktop://${event}`, (e) => fn(e.payload));
}
