import { api } from "../api";
import { time } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import { usePlaybackScrub } from "./usePlaybackScrub";

export default function PlaybackProgress() {
  const { player, t, act } = useMusicAppContext();
  const { position, handlers } = usePlaybackScrub(player, (ms) =>
    act(() => api.seek(ms)),
  );

  return (
    <div className="progress">
      <input
        type="range"
        aria-label={t.duration}
        min={0}
        max={Math.max(1, player.durationMs)}
        disabled={!player.trackId || player.durationMs <= 0}
        value={position}
        data-no-swipe
        style={
          {
            "--progress":
              (position / Math.max(1, player.durationMs)) * 100 + "%",
            touchAction: "none",
          } as React.CSSProperties
        }
        {...handlers}
      />
      <div>
        <span>{time(position)}</span>
        <span>{time(player.durationMs)}</span>
      </div>
    </div>
  );
}
