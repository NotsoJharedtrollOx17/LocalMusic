import { useMusicAppContext } from "./MusicAppContext";
import PlaybackProgress from "./PlaybackProgress";
import TransportControls from "./TransportControls";
import PlayerTrackActions from "./PlayerTrackActions";

export default function PlayerFooter({ view }: { view: "player" | "queue" }) {
  const { current } = useMusicAppContext();
  if (!current) return null;
  return (
    <>
      <PlayerTrackActions view={view} />
      <PlaybackProgress />
      <TransportControls />
    </>
  );
}
