import { useState } from "react";
import { Shield } from "lucide-react";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function PrivatePlaybackToggle() {
  const { player, setPlayer, current, t, act } = useMusicAppContext();
  const [pending, setPending] = useState<boolean | null>(null);
  return (
    <label className="check-label" aria-busy={pending !== null}>
      <input
        type="checkbox"
        checked={pending ?? player.excluded}
        disabled={current?.demo || pending !== null}
        onChange={(event) => {
          const excluded = event.currentTarget.checked;
          setPending(excluded);
          void act(async () => {
            await api.setExcluded(excluded);
            setPlayer(await api.playback());
          }).finally(() => setPending(null));
        }}
      />
      <Shield size={16} />
      {t.private}
    </label>
  );
}
