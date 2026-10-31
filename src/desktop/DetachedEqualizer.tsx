import { ArrowLeft } from "lucide-react";
import { IconButton } from "../components";
import { useBackLayer } from "../navigation";
import { usePlayerContext } from "../app/PlayerContext";
import SoundControls from "../sound/SoundControls";
import WindowControls from "./WindowControls";

export default function DetachedEqualizer() {
  const { t, settings, setModal, soundController } = usePlayerContext();
  const close = () => setModal(null);
  useBackLayer(true, close);
  return (
    <main className="detached-equalizer" aria-label={t.equalizer}>
      <header className="detached-equalizer-header">
        <IconButton label={t.back} onClick={close}>
          <ArrowLeft />
        </IconButton>
        <h1>{t.equalizer}</h1>
        <WindowControls view="equalizer" />
      </header>
      <div className="detached-equalizer-body">
        {soundController.state ? (
          <SoundControls
            controller={{ ...soundController, state: soundController.state }}
            language={settings?.language ?? "en"}
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
      </div>
    </main>
  );
}
