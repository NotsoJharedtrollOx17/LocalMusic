import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  enabledMenuCommands,
  type MenuCommand,
  type MenuContext,
  type MenuEvent,
  type MenuStatus,
  type NativeMenuState,
} from "./menu";

// Monotonic across remounts; no playback position/timer values enter this contract.
let revision = Date.now() * 1000;
export function useDesktopMenu(
  options: MenuContext & {
    supported: boolean;
    language: "en" | "es";
    dispatch: (command: MenuCommand) => Promise<unknown> | void;
    onError: (message: string) => void;
  },
) {
  const latest = useRef(options);
  latest.current = options;
  const [attempt, setAttempt] = useState(0),
    [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [version, setVersion] = useState(""),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    serial = useRef(Promise.resolve());
  const enabled = enabledMenuCommands({
    ...options,
    pending: options.pending || pending,
  });
  const key = JSON.stringify({
    language: options.language,
    section: options.section,
    playing: options.player.playing,
    shuffle: options.player.shuffle,
    repeat: options.player.repeat,
    enabled,
  });
  useEffect(() => {
    if (!options.supported) return;
    let disposed = false,
      off: (() => void) | undefined;
    setConnected(false);
    const setup = async () => {
      off = await listen<MenuEvent>("desktop://menu", (event) => {
        const current = latest.current;
        if (
          disposed ||
          busy.current ||
          !enabledMenuCommands(current).includes(event.payload.command)
        )
          return;
        busy.current = true;
        setPending(true);
        void Promise.resolve()
          .then(() => current.dispatch(event.payload.command))
          .catch((e) => current.onError(String(e)))
          .finally(() => {
            busy.current = false;
            if (!disposed) setPending(false);
          });
      });
      if (disposed) off();
      else setConnected(true);
    };
    void setup().catch((e) => {
      if (!disposed) {
        setReady(false);
        setError(String(e));
      }
    });
    return () => {
      disposed = true;
      off?.();
      // Disable frontend commands before losing their subscriber. Exit remains native.
      const current = latest.current;
      const disabled: NativeMenuState = {
        revision: ++revision,
        language: current.language,
        section: current.section,
        playing: current.player.playing,
        shuffle: current.player.shuffle,
        repeat: current.player.repeat,
        enabled: [],
      };
      serial.current = serial.current
        .then(async () => {
          await invoke("desktop_menu_sync", { state: disabled });
        })
        .catch(() => {});
    };
  }, [options.supported, attempt]);
  useEffect(() => {
    if (!connected) return;
    let disposed = false;
    const state: NativeMenuState = { ...JSON.parse(key), revision: ++revision };
    serial.current = serial.current
      .then(async () => {
        if (disposed) return;
        const status = await invoke<MenuStatus | undefined>(
          "desktop_menu_sync",
          { state },
        );
        if (disposed) return;
        setReady(!!status?.supported && status.ready);
        setVersion(status?.version ?? "");
        setError("");
      })
      .catch((e) => {
        if (!disposed) {
          setReady(false);
          setError(String(e));
        }
      });
    return () => {
      disposed = true;
    };
  }, [connected, key, attempt]);
  return {
    ready,
    error,
    version,
    retry: () => {
      setError("");
      setAttempt((n) => n + 1);
    },
  };
}
