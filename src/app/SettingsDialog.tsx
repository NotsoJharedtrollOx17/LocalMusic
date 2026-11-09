import { libraryStrings } from "../library/strings";
import { api, native } from "../api";

import { localDate } from "../recap/periods";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import { usePhoneLayout } from "../ux/usePhoneLayout";
import { ChevronRight } from "lucide-react";

export default function SettingsDialog() {
  const phone = usePhoneLayout();
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
            <fieldset className="settings-section">
              <legend>{t.libraryManagement}</legend>
              <button
                data-organization-origin
                className="settings-navigation"
                aria-label={libraryStrings(settings.language === "es").organize}
                aria-describedby="settings-organization-hint"
                onClick={() => setModal("organize")}
              >
                <span>
                  <strong>
                    {libraryStrings(settings.language === "es").organize}
                  </strong>
                  <small id="settings-organization-hint">
                    {t.organizationHint}
                  </small>
                </span>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </fieldset>
            <fieldset className="settings-section settings-history">
              <legend>{t.history}</legend>
              <div className="settings-history-body">
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
            </fieldset>
            {!native && <p className="method-note">{t.previewHint}</p>}
            {phone && (!native || /Android/i.test(navigator.userAgent)) && (
              <fieldset className="settings-section">
                <legend>{t.application}</legend>
                <button
                  data-about-origin
                  className="settings-navigation"
                  aria-label={t.aboutApp}
                  aria-describedby="settings-about-hint"
                  onClick={() => setModal("about")}
                >
                  <span>
                    <strong>{t.aboutApp}</strong>
                    <small id="settings-about-hint">{t.aboutHint}</small>
                  </span>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </fieldset>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
