import SoundControls from "../sound/SoundControls";
import { Modal } from "../components";
import { usePlayerContext } from "./PlayerContext";
export default function SoundDialog() {
  const { modal, setModal, soundController, settings, t } = usePlayerContext();
  if (modal !== "equalizer") return null;
  return (
    <Modal
      title={t.equalizer}
      closeLabel={t.close}
      onClose={() => setModal(null)}
    >
      {soundController.state ? (
        <SoundControls
          controller={{ ...soundController, state: soundController.state }}
          language={settings?.language ?? "en"}
        />
      ) : soundController.loading ? (
        <p role="status">{t.loadingSound}</p>
      ) : (
        <div>
          {soundController.error && <p role="alert">{soundController.error}</p>}
          <button
            className="button secondary"
            onClick={() => void soundController.refresh()}
          >
            {t.refresh}
          </button>
        </div>
      )}
    </Modal>
  );
}
