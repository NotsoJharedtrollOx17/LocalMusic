import SoundControls from "../sound/SoundControls";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SoundDialog() {
  const { modal, setModal, soundController, settings, player, soundOrigin, t } =
    useMusicAppContext();

  return (
    <>
      {modal === "sound" && (
        <Modal
          title={t.soundControls}
          closeLabel={t.close}
          onClose={() => {
            setModal(soundOrigin.current);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                document
                  .querySelector<HTMLElement>(
                    "[data-sound-trigger]:not([inert])",
                  )
                  ?.focus({ preventScroll: true });
              }),
            );
          }}
        >
          {soundController.state ? (
            <SoundControls
              controller={{ ...soundController, state: soundController.state }}
              language={settings?.language ?? "en"}
              canResume={!!player.trackId && !player.playing}
            />
          ) : soundController.loading ? (
            <p role="status">{t.loadingSound}</p>
          ) : (
            <div>
              {soundController.error && (
                <p role="alert">{soundController.error}</p>
              )}
              <button
                className="button secondary"
                onClick={() => void soundController.refresh()}
              >
                {t.refresh}
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
