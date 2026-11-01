import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { api, native } from "./api";
import { applyTheme } from "./theme";
import { installNativeShortcuts } from "./ux/nativeShortcuts";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-500-italic.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import App from "./App";
import CompanionApp from "./desktop/CompanionApp";
import AboutWindow from "./desktop/AboutWindow";
import { desktop, companionView } from "./desktop/windows";
import "./styles.css";
import "./ux.css";
import "./polish.css";
import "./player.css";
import "./playlists.css";
import "./focus.css";
import "./desktop/desktop.css";
installNativeShortcuts(native);
const aboutWindow =
  native && new URLSearchParams(location.search).get("about") === "1";
async function start() {
  if (!aboutWindow) await desktop.initialize();
  const settings = await api.settings().catch(() => undefined);
  if (settings) applyTheme(settings.theme);
  flushSync(() =>
    createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        {aboutWindow ? (
          <AboutWindow initialSettings={settings} />
        ) : companionView ? (
          <CompanionApp view={companionView} initialSettings={settings} />
        ) : (
          <App initialSettings={settings} />
        )}
      </React.StrictMode>,
    ),
  );
  if (native && !companionView && !aboutWindow) {
    const theme = document.documentElement.dataset.theme;
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    await invoke("show_main_window", { dark });
  }
}
void start().catch(console.error);
