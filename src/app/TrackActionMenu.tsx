import { ActionMenu } from "../ux";
import type { MenuAction } from "../ux/ActionMenu";
import { audioShareLabel, hasAudioShareChooser } from "../ux/sharing";
import { useMusicAppContext } from "./MusicAppContext";
import { trackMenuActions } from "./trackMenuActions";
import { usePlaybackPrivacy } from "./usePlaybackPrivacy";

export default function TrackActionMenu() {
  const {
    setModal,
    dismissModals,
    setDetail,
    setActionIds,
    menu,
    setMenu,
    cache,
    group,
    modal,
    t,
    share,
    sharing,
    openGroup,
    openEqualizer,
    player,
    playlistContext,
    playlistContextLoaded,
    suggestionFeedback,
    feedbackPending,
  } = useMusicAppContext();
  const privacy = usePlaybackPrivacy();
  if (!menu) return null;
  const track = cache[menu.track.id] ?? menu.track;
  // Inline results retain the active Library collection context.
  const context = modal ? null : group;
  const navigate = (kind: "albums" | "artists") => {
    dismissModals();
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
  const playerMenu =
    menu.anchor.hasAttribute("data-player-menu") &&
    track.id === player.trackId &&
    (modal === "player" || modal === "queue");
  const available = trackMenuActions(track, context).filter(
    (id) => id !== "share" || hasAudioShareChooser(),
  );
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
        ...available
          .filter((id) => id !== "remove" && (!playerMenu || id !== "add"))
          .map((id) => actions[id]),
        ...(!track.demo
          ? [
              {
                id: "suggestion",
                label: playlistContext.less.includes(track.id)
                  ? t.restoreSuggestions
                  : t.suggestLess,
                disabled: feedbackPending || !playlistContextLoaded,
                action: () =>
                  void suggestionFeedback(
                    track.id,
                    !playlistContext.less.includes(track.id),
                  ),
              },
            ]
          : []),
        ...(playerMenu
          ? [
              {
                id: "equalizer",
                label: t.equalizer,
                action: () => void openEqualizer(),
              },
              {
                id: "visualizer",
                label: t.visualizer,
                action: () => setModal("visualizer"),
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
        ...(available.includes("remove") ? [actions.remove] : []),
      ]}
    />
  );
}
