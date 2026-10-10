import { ActionMenu } from "../ux";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function TrackActionMenu() {
  const {
    setSearchOpen,
    setModal,
    dismissModals,
    setTab,
    setSection,
    setDetail,
    setSelectedIds,
    setSelectionMode,
    setActionIds,
    menu,
    setMenu,
    t,
    act,
    share,
    shareLabel,
    sharing,
    openGroup,
    closeGroup,
    favorite,
  } = useMusicAppContext();

  return (
    <>
      {menu && (
        <ActionMenu
          anchor={menu.anchor}
          point={menu.point}
          label={menu.track.title}
          onClose={() => setMenu(null)}
          items={[
            {
              label: t.play,
              disabled: !menu.track.available || menu.track.hidden,
              action: () => void act(() => api.play([menu.track.id])),
            },
            { label: t.favorite, action: () => void favorite(menu.track) },
            {
              label: t.details,
              action: () => {
                setDetail(menu.track);
                setModal("track");
              },
            },
            {
              label: t.albums,
              disabled: !menu.track.album,
              action: () => {
                dismissModals();
                setSearchOpen(false);
                openGroup("albums", {
                  title: menu.track.album,
                  subtitle: menu.track.artist,
                  ids: [menu.track.id],
                  track: menu.track,
                });
              },
            },
            {
              label: t.artists,
              disabled: !menu.track.artist,
              action: () => {
                dismissModals();
                setSearchOpen(false);
                openGroup("artists", {
                  title: menu.track.artist,
                  subtitle: "",
                  ids: [menu.track.id],
                  track: menu.track,
                });
              },
            },
            {
              label: t.addToPlaylist,
              action: () => {
                setActionIds([menu.track.id]);
                setModal("add");
              },
            },
            {
              label: shareLabel,
              disabled: !menu.track.available || sharing,
              action: () => void share([menu.track.id]),
            },
            {
              label: t.selectSongs,
              disabled: menu.track.hidden,
              action: () => {
                dismissModals();
                setSearchOpen(false);
                setTab("library");
                setSection("songs");
                closeGroup();
                setSelectionMode(true);
                setSelectedIds([menu.track.id]);
              },
            },
            {
              label: t.removeLibrary,
              disabled: menu.track.hidden,
              action: () => {
                setActionIds([menu.track.id]);
                setModal("remove");
              },
            },
          ]}
        />
      )}
    </>
  );
}
