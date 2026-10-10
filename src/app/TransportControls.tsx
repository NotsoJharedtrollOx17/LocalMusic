import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
} from "lucide-react";
import { api } from "../api";
import { IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function TransportControls() {
  const { player, t, act } = useMusicAppContext();

  return (
    <div className="transport">
      <IconButton
        label={t.shuffle}
        active={player.shuffle}
        onClick={() => void act(() => api.setShuffle(!player.shuffle))}
      >
        <Shuffle size={21} />
      </IconButton>
      <IconButton
        label={t.previous}
        onClick={() => void act(() => api.previous())}
      >
        <SkipBack size={26} fill="currentColor" />
      </IconButton>
      <button
        className="play-circle"
        aria-label={player.playing ? t.pause : t.play}
        onClick={() => void act(() => api.toggle())}
      >
        {player.playing ? (
          <Pause size={28} fill="currentColor" />
        ) : (
          <Play size={28} fill="currentColor" />
        )}
      </button>
      <IconButton label={t.next} onClick={() => void act(() => api.next())}>
        <SkipForward size={26} fill="currentColor" />
      </IconButton>
      <IconButton
        label={t.repeat + ": " + player.repeat}
        active={player.repeat !== "off"}
        onClick={() =>
          void act(() =>
            api.setRepeat(
              player.repeat === "off"
                ? "all"
                : player.repeat === "all"
                  ? "one"
                  : "off",
            ),
          )
        }
      >
        {player.repeat === "one" ? <Repeat1 size={21} /> : <Repeat size={21} />}
      </IconButton>
    </div>
  );
}
