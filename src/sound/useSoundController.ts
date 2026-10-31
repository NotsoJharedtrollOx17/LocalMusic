import { useEffect, useState, useSyncExternalStore } from "react";
import { api, native } from "../api";
import { onDesktop, type Change } from "../desktop/windows";
import { SoundStateController } from "./SoundStateController";

/** App ownership prevents dialog transitions abandoning in-flight edits. */
export function useSoundController(active: boolean) {
  const [controller] = useState(() => new SoundStateController(api));
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
  );
  useEffect(() => {
    if (!active) {
      void controller.flush();
      controller.clearBypass();
      return;
    }
    void controller.refresh();
    let disposed = false,
      off: (() => void) | undefined;
    if (native)
      void onDesktop<Change>("changed", (event) => {
        if (event.domain === "sound") void controller.refresh();
      }).then((unlisten) => {
        if (disposed) unlisten();
        else off = unlisten;
      });
    const timer = setInterval(() => void controller.refresh(), 1000);
    const focus = () => void controller.refresh();
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      off?.();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [active, controller]);
  useEffect(
    () => () => {
      void controller.flush();
      controller.clearBypass();
    },
    [controller],
  );
  return {
    ...snapshot,
    edit: controller.edit,
    flush: controller.flush,
    refresh: controller.refresh,
    action: controller.action,
  };
}
export type SoundController = ReturnType<typeof useSoundController>;
