import PrivatePlaybackToggle from "./PrivatePlaybackToggle";
import { Heart } from "lucide-react";
import { PlayerSurface } from "../ux";
import { api } from "../api";
import { Cover, TrackRow, IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import PlaybackProgress from "./PlaybackProgress";
import TransportControls from "./TransportControls";

export default function PlayerDialog() {
  const {
    cache,
    queueLimit,
    setQueueLimit,
    player,
    modal,
    playerParent,
    setModal,
    setMenu,
    t,
    act,
    current,
    openSound,
    favorite,
  } = useMusicAppContext();
  const view = modal === "player" || modal === "queue" ? modal : playerParent;

  return (
    <>
      {view && current && (
        <PlayerSurface
          title={view === "queue" ? t.queue : t.nowPlaying}
          closeLabel={t.close}
          queueLabel={t.queue}
          playerLabel={t.nowPlaying}
          view={view}
          trackId={current.id}
          onView={setModal}
          onClose={() => setModal(null)}
          footer={
            <>
              <PlaybackProgress />
              <TransportControls />
              <div className="player-options">
                <button
                  className="text-button"
                  onClick={() => void openSound()}
                >
                  {t.soundControls}
                </button>
                <button
                  className="text-button"
                  onClick={(e) =>
                    setMenu({ track: current, anchor: e.currentTarget })
                  }
                >
                  {t.details}
                </button>
                <PrivatePlaybackToggle />
              </div>
            </>
          }
        >
          {view === "player" ? (
            <div className="full-player">
              <p className="eyebrow">{t.playingFrom}</p>
              <Cover track={current} className="player-cover" large />
              <div className="player-title">
                <div>
                  <h2>{current.title}</h2>
                  <p>{current.artist || t.unknownArtist}</p>
                </div>
                <IconButton
                  label={t.favorite}
                  active={current.favorite}
                  onClick={() => void favorite(current)}
                >
                  <Heart
                    size={26}
                    fill={current.favorite ? "currentColor" : "none"}
                  />
                </IconButton>
              </div>
              {current.demo && <p className="small-muted">{t.sampleNote}</p>}
            </div>
          ) : (
            <div className="queue-content">
              {player.queue.length ? (
                player.queue.slice(0, queueLimit).map(
                  (id, i) =>
                    cache[id] &&
                    (!cache[id].hidden || id === player.trackId) && (
                      <TrackRow
                        key={id + ":" + i}
                        track={cache[id]}
                        index={i}
                        playing={i === player.queueIndex && player.playing}
                        unknownArtist={t.unknownArtist}
                        labels={t}
                        onPlay={() =>
                          void act(() =>
                            cache[id].hidden
                              ? api.toggle()
                              : api.play(player.queue, i),
                          )
                        }
                        edit={{
                          up: i
                            ? () =>
                                void act(() => {
                                  const ids = [...player.queue];
                                  [ids[i], ids[i - 1]] = [ids[i - 1], ids[i]];
                                  return api.reorderQueue(ids);
                                })
                            : undefined,
                          down:
                            i < player.queue.length - 1
                              ? () =>
                                  void act(() => {
                                    const ids = [...player.queue];
                                    [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                                    return api.reorderQueue(ids);
                                  })
                              : undefined,
                          remove:
                            i !== player.queueIndex
                              ? () =>
                                  void act(() =>
                                    api.reorderQueue(
                                      player.queue.filter((_, n) => n !== i),
                                    ),
                                  )
                              : undefined,
                        }}
                      />
                    ),
                )
              ) : (
                <p className="empty-small">{t.emptyQueue}</p>
              )}
              {player.queue.length > queueLimit && (
                <button
                  className="button secondary full-width"
                  onClick={() => setQueueLimit((n) => n + 60)}
                >
                  {t.loadMore}
                </button>
              )}
            </div>
          )}
        </PlayerSurface>
      )}
    </>
  );
}
