import { api, native } from "../api";

import { recapYears } from "../domain";
import { Modal } from "../components";
import { type Settings } from "../types";
import { useMusicAppContext } from "./MusicAppContext";

export default function SettingsDialog() {
  const {
    settings,
    setSettings,
    setRecap,
    setSnapshotMode,
    setSnapshots,
    setYear,
    setNotice,
    modal,
    setModal,
    t,
    act,
    openSound,
    formatDate,
  } = useMusicAppContext();

  return (
    <>
      {modal === "settings" && settings && (
        <Modal
          closeLabel={t.close}
          title={t.settings}
          onClose={() => setModal(null)}
        >
          <div className="settings-form">
            <button
              className="button secondary"
              onClick={() => void openSound()}
            >
              {t.soundControls}
            </button>
            <label>
              {t.language}
              <select
                aria-label={t.language}
                value={settings.language}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    language: e.target.value as Settings["language"],
                  })
                }
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
            <label>
              {t.theme}
              <select
                aria-label={t.theme}
                value={settings.theme}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    theme: e.target.value as Settings["theme"],
                  })
                }
              >
                {(["system", "light", "dark"] as const).map((x) => (
                  <option key={x} value={x}>
                    {t[x]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.timeZone}
              <select
                aria-label={t.timeZone}
                value={settings.timeZone}
                onChange={(e) =>
                  setSettings({ ...settings, timeZone: e.target.value })
                }
              >
                {[
                  ...new Set([
                    settings.timeZone,
                    "UTC",
                    ...(typeof Intl.supportedValuesOf === "function"
                      ? Intl.supportedValuesOf("timeZone")
                      : [
                          "UTC",
                          "America/Los_Angeles",
                          "America/New_York",
                          "Europe/Madrid",
                        ]),
                  ]),
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <div className="settings-history">
              <h3>{t.history}</h3>
              <p>
                {t.since} {formatDate(settings.historyEnabledSince)}
              </p>
              <button
                className="text-button danger"
                onClick={() =>
                  void act(async () => {
                    if (confirm(t.deleteWarning)) {
                      await api.deleteHistory();
                      const nextSettings = await api.settings();
                      const nextYear = recapYears(nextSettings)[0];
                      setSettings(nextSettings);
                      setSnapshotMode(false);
                      setYear(nextYear);
                      setRecap(await api.recap(nextYear));
                      setSnapshots([]);
                      setNotice(t.done);
                    }
                  })
                }
              >
                {t.deleteHistory}
              </button>
            </div>
            {!native && <p className="method-note">{t.previewHint}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
