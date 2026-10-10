import ShareRecap from "../ShareRecap";
import { useMusicAppContext } from "./MusicAppContext";

export default function RecapExportDialog() {
  const { settings, shareRecap, setShareRecap, snapshotMode } =
    useMusicAppContext();

  return (
    <>
      {shareRecap && (
        <ShareRecap
          recap={shareRecap}
          frozen={snapshotMode}
          language={settings?.language ?? "en"}
          onClose={() => setShareRecap(null)}
        />
      )}
    </>
  );
}
