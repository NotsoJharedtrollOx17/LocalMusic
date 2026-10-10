import { Check } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistOptions() {
  const { request, setRequest, t } = useMusicAppContext();

  return (
    <div className="generator-options">
      <label className="check-label">
        <input
          type="checkbox"
          checked={request.preferFavorites}
          onChange={(e) =>
            setRequest({
              ...request,
              preferFavorites: e.target.checked,
            })
          }
        />
        {t.preferFavorites}
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={request.avoidHeardToday}
          onChange={(e) =>
            setRequest({
              ...request,
              avoidHeardToday: e.target.checked,
            })
          }
        />
        {t.avoidToday}
      </label>
      <span className="small-muted">
        <Check size={15} />
        {t.noRepeats}
      </span>
    </div>
  );
}
