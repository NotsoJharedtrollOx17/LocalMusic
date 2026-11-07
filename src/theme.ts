import type { Settings } from "./types";
import { isTauri, invoke } from "@tauri-apps/api/core";
let appearanceWrite: Promise<unknown> = Promise.resolve();
export function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.style.removeProperty("background-color");
  root.style.removeProperty("color-scheme");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#141615" : "#faf8f4");
  try {
    localStorage.setItem("local-music-theme", theme);
  } catch {
    /* storage can be unavailable */
  }
  if (/Android/i.test(navigator.userAgent) && isTauri()) {
    appearanceWrite = appearanceWrite
      .catch(() => {})
      .then(() => invoke("set_android_appearance", { dark }));
    void appearanceWrite.catch((error) =>
      console.warn("Could not update system bar appearance", error),
    );
  }
}
