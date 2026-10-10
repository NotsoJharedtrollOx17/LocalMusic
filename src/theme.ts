import type { Settings } from "./types";
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
}
