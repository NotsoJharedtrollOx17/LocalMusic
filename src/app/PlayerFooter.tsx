import { MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import PlaybackProgress from "./PlaybackProgress";
import TransportControls from "./TransportControls";
import PrivatePlaybackToggle from "./PrivatePlaybackToggle";

export default function PlayerFooter() {
  const { current, menu, setMenu, openSound, t } = useMusicAppContext();
  if (!current) return null;
  return (
    <>
      <PlaybackProgress />
      <TransportControls />
      <div className="player-options">
        <button
          className="button secondary player-option"
          data-sound-trigger
          onClick={() => void openSound()}
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>{t.soundControls}</span>
        </button>
        <button
          className="button secondary player-option"
          aria-haspopup="menu"
          aria-expanded={
            menu?.track.id === current.id &&
            menu.anchor.classList.contains("player-option")
          }
          onClick={(event) =>
            setMenu({ track: current, anchor: event.currentTarget })
          }
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          <span>{t.actions}</span>
        </button>
        <PrivatePlaybackToggle />
      </div>
    </>
  );
}
