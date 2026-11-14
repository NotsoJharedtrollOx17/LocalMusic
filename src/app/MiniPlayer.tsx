import OutputStatus from "./OutputStatus";
import {
  ListMusic,
  ArrowUpRight,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { api } from "../api";
import { Cover, IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import PlaybackProgress from "./PlaybackProgress";
import TransportControls from "./TransportControls";
import { useMiniPlayerGesture } from "../ux/useMiniPlayerGesture";

export default function MiniPlayer() {
  const { player, setModal, t, act, current, favorite } = useMusicAppContext();
  const gesture = useMiniPlayerGesture(() => setModal("player"), current?.id);

  return (
    <>
      {current && (
        <div className="mini-player-dock">
          <div className="mini-player">
            <button className="mini-track" data-no-swipe {...gesture}>
              <Cover track={current} />
              <span>
                <strong>{current.title}</strong>
                <small>{current.artist || t.unknownArtist}</small>
              </span>
              {current.demo && <span className="mini-sample">SAMPLE</span>}
            </button>
            <div className="mini-center">
              <OutputStatus />
              <TransportControls />
              <PlaybackProgress />
            </div>
            <div className="mini-actions">
              <IconButton
                label={t.favorite}
                active={current.favorite}
                onClick={() => void favorite(current)}
              >
                <Heart
                  size={19}
                  fill={current.favorite ? "currentColor" : "none"}
                />
              </IconButton>
              <IconButton label={t.queue} onClick={() => setModal("queue")}>
                <ListMusic size={22} />
              </IconButton>
              <IconButton
                label={t.nowPlaying}
                onClick={() => setModal("player")}
              >
                <ArrowUpRight size={20} />
              </IconButton>
            </div>
            <div className="mobile-mini-play">
              <IconButton
                label={t.previous}
                onClick={() => void act(() => api.previous())}
              >
                <SkipBack fill="currentColor" />
              </IconButton>
              <IconButton
                label={player.playing ? t.pause : t.play}
                onClick={() => void act(() => api.toggle())}
              >
                {player.playing ? (
                  <Pause fill="currentColor" />
                ) : (
                  <Play fill="currentColor" />
                )}
              </IconButton>
              <IconButton
                label={t.next}
                onClick={() => void act(() => api.next())}
              >
                <SkipForward fill="currentColor" />
              </IconButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
