import { ActionMenu } from "../ux";
import type { MenuAction } from "../ux/ActionMenu";
import { audioShareLabel, hasAudioShareChooser } from "../ux/sharing";
import { useMusicAppContext } from "./MusicAppContext";
import { trackMenuActions } from "./trackMenuActions";
import { usePlaybackPrivacy } from "./usePlaybackPrivacy";

export default function TrackActionMenu() {
  const {
    setSearchOpen,
    setModal,
    dismissModals,
    setDetail,
    setActionIds,
    menu,
    setMenu,
    cache,
    group,
    searchOpen,
    modal,
    t,
    share,
    sharing,
    openGroup,
    openSound,
    player,
  } = useMusicAppContext();
  const privacy = usePlaybackPrivacy();
  if (!menu) return null;
  const track = cache[menu.track.id] ?? menu.track;
  // Search/player objects are independent of the Library collection underneath.
  const context = searchOpen || modal ? null : group;
  const navigate = (kind: "albums" | "artists") => {
    dismissModals();
    setSearchOpen(false);
    openGroup(
      kind,
      {
        title: kind === "albums" ? track.album : track.artist,
        subtitle: kind === "albums" ? track.artist : "",
        ids: [track.id],
        track,
      },
      menu.anchor,
    );
  };
  const actions: Record<
    ReturnType<typeof trackMenuActions>[number],
    MenuAction
  > = {
    add: {
      id: "add",
      label: t.addToPlaylist,
      action: () => {
        setActionIds([track.id]);
        setModal("add");
      },
    },
    share: {
      id: "share",
      label: audioShareLabel(t, 1),
      disabled: !track.available || sharing,
      disabledReason: !track.available ? t.unavailable : t.sharingAudio,
      action: () => void share([track.id]),
    },
    details: {
      id: "details",
      label: t.details,
      action: () => {
        setDetail(track);
        setModal("track");
      },
    },
    album: {
      id: "album",
      label: t.goToAlbum,
      action: () => navigate("albums"),
    },
    artist: {
      id: "artist",
      label: t.goToArtist,
      action: () => navigate("artists"),
    },
    remove: {
      id: "remove",
      label: t.removeLibrary,
      danger: true,
      action: () => {
        setActionIds([track.id]);
        setModal("remove");
      },
    },
  };
  return (
    <ActionMenu
      anchor={menu.anchor}
      point={menu.point}
      label={track.title}
      onClose={() => setMenu(null)}
      items={[
        ...trackMenuActions(track, context)
          .filter((id) => id !== "share" || hasAudioShareChooser())
          .map((id) => actions[id]),
        ...(menu.anchor.hasAttribute("data-player-menu") &&
        track.id === player.trackId &&
        (modal === "player" || modal === "queue")
          ? [
              {
                id: "sound",
                label: t.soundControls,
                action: () => void openSound(),
              },
              {
                id: "privacy",
                label: t.private,
                checked: privacy.checked,
                checkType: "checkbox" as const,
                keepOpen: true,
                busy: privacy.pending,
                disabled: privacy.disabled,
                disabledReason: track.demo ? t.sampleNote : undefined,
                action: privacy.toggle,
              },
            ]
          : []),
      ]}
    />
  );
}
