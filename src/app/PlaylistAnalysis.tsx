import { useEffect, useState } from "react";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistAnalysis() {
  const { playlistContext, buildingMix, generationPhase, t } =
    useMusicAppContext();
  const [calculated, setCalculated] = useState(false);
  useEffect(() => {
    if (buildingMix) setCalculated(generationPhase === "matching");
  }, [buildingMix, generationPhase]);
  return (
    <div className="analysis-coverage">
      <p role="status">
        {calculated
          ? t.analysisCoverage
              .replace("{count}", String(playlistContext.analyzed))
              .replace("{total}", String(playlistContext.total))
          : t.analysisPlaceholder}
      </p>
    </div>
  );
}
