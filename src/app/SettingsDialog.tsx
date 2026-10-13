import { api, native } from "../api";

import { recapYears } from "../domain";
import { Modal } from "../components";
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
            <fieldset className="settings-choice">
              <legend>{t.language}</legend>
              <div>
                {(["en", "es"] as const).map((language) => (
                  <button
                    key={language}
                    type="button"
                    aria-pressed={settings.language === language}
                    onClick={() => setSettings({ ...settings, language })}
                  >
                    {language === "en" ? "English" : "Español"}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="settings-choice">
              <legend>{t.theme}</legend>
              <div>
                {(["system", "light", "dark"] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    aria-pressed={settings.theme === theme}
                    onClick={() => setSettings({ ...settings, theme })}
                  >
                    {t[theme]}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="settings-history">
              <h3>{t.history}</h3>
              <p>
                {t.since} {formatDate(settings.historyEnabledSince)}
              </p>
              <button
                className="button secondary danger"
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
