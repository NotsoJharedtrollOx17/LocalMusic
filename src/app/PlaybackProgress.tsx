import { api } from "../api";
import { time } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaybackProgress() {
  const { player, t, act } = useMusicAppContext();

  return (
    <div className="progress">
      <input
        type="range"
        aria-label={t.duration}
        min={0}
        max={Math.max(1, player.durationMs)}
        value={Math.min(player.positionMs, player.durationMs)}
        style={
          {
            "--progress":
              (player.positionMs / Math.max(1, player.durationMs)) * 100 + "%",
          } as React.CSSProperties
        }
        onChange={(e) => void act(() => api.seek(Number(e.target.value)))}
      />
      <div>
        <span>{time(player.positionMs)}</span>
        <span>{time(player.durationMs)}</span>
      </div>
    </div>
  );
}
