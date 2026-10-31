import WindowControls from "../desktop/WindowControls";
import { companionView } from "../desktop/windows";
import { PlayerSurface } from "../ux";
import { api } from "../api";
import { Cover, TrackRow } from "../components";
import { usePlayerContext } from "./PlayerContext";
import PlayerFooter from "./PlayerFooter";
import PlayerMenuButton from "./PlayerMenuButton";

export default function PlayerDialog() {
  const {
    cache,
    queueLimit,
    setQueueLimit,
    player,
    modal,
    playerParent,
    setModal,
    t,
    act,
    current,
  } = usePlayerContext();
  const view = modal === "player" || modal === "queue" ? modal : playerParent;

  return (
    <>
      {view && current && (
        <PlayerSurface
          standalone={companionView === "player"}
          title={view === "queue" ? t.queue : t.nowPlaying}
          closeLabel={companionView === "player" ? t.returnToMain : t.close}
          view={view}
          active={modal === "player" || modal === "queue"}
          trackId={current.id}
          onView={setModal}
          onClose={() => setModal(null)}
          footer={<PlayerFooter view={view} />}
          headerAction={
            <div className="player-header-actions">
              <WindowControls view="player" />
              <PlayerMenuButton />
            </div>
          }
        >
          {view === "player" ? (
            <div className="full-player">
              <Cover track={current} className="player-cover" large />
              <div className="player-title">
                <div>
                  <h2>{current.title}</h2>
                  <p>{current.artist || t.unknownArtist}</p>
                </div>
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
