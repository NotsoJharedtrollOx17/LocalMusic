import { useRef, useState } from "react";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export function usePlaybackPrivacy() {
  const { player, setPlayer, current, act } = useMusicAppContext();
  const [pending, setPending] = useState<boolean | null>(null);
  const writing = useRef(false);
  const toggle = () => {
    if (writing.current || current?.demo) return;
    writing.current = true;
    const excluded = !player.excluded;
    setPending(excluded);
    void act(async () => {
      await api.setExcluded(excluded);
      setPlayer(await api.playback());
    }).finally(() => {
      writing.current = false;
      setPending(null);
    });
  };
  return {
    checked: pending ?? player.excluded,
    pending: pending !== null,
    disabled: !!current?.demo || pending !== null,
    toggle,
  };
}
