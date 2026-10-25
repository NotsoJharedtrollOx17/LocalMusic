import { SlidersHorizontal } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import PlaybackProgress from "./PlaybackProgress";
import TransportControls from "./TransportControls";
import PrivatePlaybackToggle from "./PrivatePlaybackToggle";
import PlayerTrackActions from "./PlayerTrackActions";

export default function PlayerFooter({ view }: { view: "player" | "queue" }) {
  const { current, openSound, t } = useMusicAppContext();
  if (!current) return null;
  return (
    <>
      <PlayerTrackActions view={view} />
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
        <PrivatePlaybackToggle />
      </div>
    </>
  );
}
