import { useLayoutEffect, useRef, useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function PrivatePlaybackToggle() {
  const { player, setPlayer, current, t, act } = useMusicAppContext();
  const [pending, setPending] = useState<boolean | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  useLayoutEffect(() => {
    if (pending !== null || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (
      document.activeElement === document.body &&
      input.current &&
      !input.current.closest("[inert],[hidden]")
    )
      input.current.focus({ preventScroll: true });
  }, [pending]);
  const checked = pending ?? player.excluded;
  const disabled = !!current?.demo || pending !== null;
  return (
    <label
      className="button secondary player-option player-privacy"
      data-checked={checked}
      data-disabled={disabled}
      aria-busy={pending !== null}
    >
      <input
        ref={input}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          restoreFocus.current = document.activeElement === event.currentTarget;
          const excluded = event.currentTarget.checked;
          setPending(excluded);
          void act(async () => {
            await api.setExcluded(excluded);
            setPlayer(await api.playback());
          }).finally(() => setPending(null));
        }}
      />
      {checked ? (
        <ShieldCheck size={20} aria-hidden="true" />
      ) : (
        <Shield size={20} aria-hidden="true" />
      )}
      <span>{t.private}</span>
    </label>
  );
}
