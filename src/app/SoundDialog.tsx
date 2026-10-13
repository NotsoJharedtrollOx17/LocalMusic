import SoundControls from "../sound/SoundControls";
import SoundOptions from "./SoundOptions";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SoundDialog() {
  const { modal, setModal, soundController, settings, t } =
    useMusicAppContext();
  if (modal !== "sound" && modal !== "equalizer" && modal !== "adapt")
    return null;
  return (
    <Modal
      key={modal}
      title={
        modal === "sound"
          ? t.soundControls
          : modal === "equalizer"
            ? t.equalizer
            : t.adaptSound
      }
      closeLabel={t.close}
      onClose={() => {
        setModal(null);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const selector =
              modal === "sound"
                ? "[data-sound-trigger]:not([inert]),[data-library-menu]"
                : `[data-sound-view="${modal}"]`;
            Array.from(document.querySelectorAll<HTMLElement>(selector))
              .find((el) => !el.closest("[inert],[hidden]"))
              ?.focus({ preventScroll: true });
          }),
        );
      }}
    >
      {soundController.state ? (
        modal === "sound" ? (
          <SoundOptions />
        ) : (
          <SoundControls
            key={modal}
            view={modal}
            controller={{ ...soundController, state: soundController.state }}
            language={settings?.language ?? "en"}
          />
        )
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
