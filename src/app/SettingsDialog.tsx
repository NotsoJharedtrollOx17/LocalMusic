import { libraryStrings } from "../library/strings";
import { api, native } from "../api";

import { localDate } from "../recap/periods";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SettingsDialog() {
  const {
    settings,
    setSettings,
    setRecap,
    setSnapshotMode,
    setSnapshots,
    setRecapSelection,
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
            <button
              data-organization-origin
              className="button secondary"
              onClick={() => setModal("organize")}
            >
              {libraryStrings(settings.language === "es").organize}
            </button>
            <div className="settings-history">
              <h3>{t.history}</h3>
              <p>{t.historyHint}</p>
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
                      const nextSelection = {
                        kind: nextSettings.recapPeriod ?? ("year" as const),
                        anchorDate: localDate(
                          new Date(),
                          nextSettings.timeZone,
                        ),
                      };
                      setSettings(nextSettings);
                      setSnapshotMode(false);
                      setRecapSelection(nextSelection);
                      setRecap(await api.recap(nextSelection));
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
