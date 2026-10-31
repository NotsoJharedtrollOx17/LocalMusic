import { usePlayerContext } from "./PlayerContext";
import PlaybackProgress from "./PlaybackProgress";
import TransportControls from "./TransportControls";
import PlayerTrackActions from "./PlayerTrackActions";

export default function PlayerFooter({ view }: { view: "player" | "queue" }) {
  const { current } = usePlayerContext();
  if (!current) return null;
  return (
    <>
      <PlayerTrackActions view={view} />
      <PlaybackProgress />
      <TransportControls />
    </>
  );
}
