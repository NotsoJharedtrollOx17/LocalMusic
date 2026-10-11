import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "../api";
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
    const timer = setInterval(() => void controller.refresh(), 1000);
    const focus = () => void controller.refresh();
    window.addEventListener("focus", focus);
    return () => {
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
