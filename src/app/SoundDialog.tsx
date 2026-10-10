import SoundControls from "../sound/SoundControls";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SoundDialog() {
  const {
    modal,
    setModal,
    sound,
    settings,
    player,
    setSound,
    soundLoading,
    soundOrigin,
    t,
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
            <SoundControls
              initial={sound}
              onState={setSound}
              language={settings?.language ?? "en"}
              canResume={!!player.trackId && !player.playing}
            />
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
