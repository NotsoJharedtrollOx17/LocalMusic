import { useMusicAppContext } from "./MusicAppContext";
import LoadingIndicator from "../components/LoadingIndicator";

export default function PlaylistAnalysis() {
  const { playlistContext, playlistContextLoaded, t } = useMusicAppContext();
  return (
    <div className="analysis-coverage">
      {playlistContextLoaded ? (
        <p role="status">
          {t.analysisCoverage
            .replace("{count}", String(playlistContext.analyzed))
            .replace("{total}", String(playlistContext.total))}
        </p>
      ) : (
        <LoadingIndicator label={t.loading} compact />
      )}
    </div>
  );
}
