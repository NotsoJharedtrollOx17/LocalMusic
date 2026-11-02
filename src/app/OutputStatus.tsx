import { usePlayerContext } from "./PlayerContext";
import { libraryStrings } from "../library/strings";
export default function OutputStatus() {
  const { player, settings } = usePlayerContext();
  return player.outputMode === "silent" && player.playing ? (
    <p className="output-status" role="status">
      {libraryStrings(settings?.language === "es").silent}
    </p>
  ) : null;
}
