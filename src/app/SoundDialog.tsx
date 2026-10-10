import { api } from "../api";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SoundDialog() {
  const {
    modal,
    setModal,
    sound,
    setSound,
    soundLoading,
    soundOrigin,
    t,
    act,
    openSound,
  } = useMusicAppContext();

  return (
    <>
      {modal === "sound" && (
        <Modal
          title={t.soundControls}
          closeLabel={t.close}
          onClose={() => setModal(soundOrigin.current)}
        >
          {soundLoading ? (
            <p role="status">{t.loadingLibrary}</p>
          ) : sound ? (
            <div className="settings-form">
              {sound.equalizer && (
                <>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={sound.enabled}
                      onChange={(e) => {
                        const enabled = e.currentTarget.checked;
                        void act(async () => {
                          await api.setEqualizer(enabled, sound.preset);
                          setSound(await api.soundCapabilities());
                        });
                      }}
                    />
                    {t.equalizer}
                  </label>
                  <label>
                    {t.preset}
                    <select
                      value={sound.preset}
                      onChange={(e) => {
                        const preset = Number(e.currentTarget.value);
                        void act(async () => {
                          await api.setEqualizer(sound.enabled, preset);
                          setSound(await api.soundCapabilities());
                        });
                      }}
                    >
                      {sound.presets.map((name, i) => (
                        <option key={i} value={i}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {sound.systemPanel && (
                <button
                  className="button secondary"
                  onClick={() => void act(() => api.openSoundPanel())}
                >
                  {t.deviceSound}
                </button>
              )}
              {!sound.equalizer && !sound.systemPanel && (
                <p className="operation-note">{t.soundUnavailable}</p>
              )}
            </div>
          ) : (
            <button
              className="button secondary"
              onClick={() => void openSound()}
            >
              {t.refresh}
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
