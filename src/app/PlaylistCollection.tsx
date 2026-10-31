import { useState } from "react";
import { createPortal } from "react-dom";
import RenamePlaylistDialog from "./RenamePlaylistDialog";
import { ListMusic, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { ActionMenu } from "../ux";
import { api } from "../api";
import type { Playlist } from "../types";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistCollection({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const {
    lists,
    filteredLists,
    inlineSearch,
    t,
    openPlaylist,
    formatMusicCount,
    act,
    refreshLists,
    setNotice,
  } = useMusicAppContext();
  const [menu, setMenu] = useState<{
    playlist: Playlist;
    anchor: HTMLElement;
  } | null>(null);
  const [renaming, setRenaming] = useState<Playlist | null>(null);
  if (inlineSearch.active && !filteredLists.length) return null;
  const content = (
    <>
      {!embedded && (
        <h2 id="saved-playlists-heading" className="playlist-section-heading">
          {t.yourPlaylists}
        </h2>
      )}
      {filteredLists.length ? (
        <div
          className={embedded ? "playlist-search-items" : "playlist-collection"}
        >
          {filteredLists.map((p) => (
            <div
              className="saved-playlist-card"
              key={p.id}
              data-playlist-id={p.id}
            >
              <button
                className="playlist-tile"
                onClick={() => void openPlaylist(p)}
              >
                <div className="playlist-tile-art">
                  <ListMusic size={35} />
                  <span>{String(p.trackIds.length).padStart(2, "0")}</span>
                </div>
                <div>
                  <p className="eyebrow">
                    {p.kind === "generated"
                      ? t.generated
                      : p.kind === "recap"
                        ? t.year
                        : t.manual}
                  </p>
                  <h3>{p.title}</h3>
                  <span>{formatMusicCount(p.trackIds.length)}</span>
                </div>
                <ArrowUpRight size={22} />
              </button>
              <button
                className="saved-playlist-menu icon-button"
                type="button"
                aria-label={`${t.playlistActions}: ${p.title}`}
                aria-haspopup="menu"
                aria-expanded={menu?.playlist.id === p.id}
                onClick={(e) =>
                  setMenu({ playlist: p, anchor: e.currentTarget })
                }
              >
                <MoreHorizontal size={21} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="saved-playlists-empty">{t.noSavedPlaylists}</p>
      )}
      {menu && (
        <ActionMenu
          anchor={menu.anchor}
          label={t.playlistActions}
          onClose={() => setMenu(null)}
          items={[
            {
              id: "rename",
              label: t.renamePlaylist,
              action: () => setRenaming(menu.playlist),
            },
            {
              id: "delete",
              label: t.deletePlaylist,
              danger: true,
              action: () => {
                const playlist = menu.playlist;
                void act(async () => {
                  if (window.confirm(`${t.delete} ${playlist.title}?`)) {
                    await api.deletePlaylist(playlist.id);
                    await refreshLists();
                  }
                });
              },
            },
          ]}
        />
      )}
      {renaming &&
        createPortal(
          <RenamePlaylistDialog
            playlist={renaming}
            onClose={() => setRenaming(null)}
            onSave={async (title) => {
              const latest = lists.find(
                (playlist) => playlist.id === renaming.id,
              );
              if (!latest) throw new Error(t.unavailable);
              await api.savePlaylist({ ...latest, title });
              await refreshLists();
              setNotice(t.playlistRenamed);
              setRenaming(null);
            }}
          />,
          document.body,
        )}
    </>
  );
  return embedded ? (
    content
  ) : (
    <section
      className="saved-playlists"
      aria-labelledby="saved-playlists-heading"
    >
      {content}
    </section>
  );
}
