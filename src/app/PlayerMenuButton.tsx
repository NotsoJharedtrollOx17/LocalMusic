import { MoreHorizontal } from "lucide-react";
import { usePlayerContext } from "./PlayerContext";

export default function PlayerMenuButton() {
  const { current, menu, setMenu, t } = usePlayerContext();
  if (!current) return null;
  return (
    <button
      type="button"
      className="icon-button"
      data-player-menu
      data-sound-trigger
      aria-label={t.playerOptions}
      title={t.playerOptions}
      aria-haspopup="menu"
      aria-expanded={menu?.anchor.hasAttribute("data-player-menu") ?? false}
      onClick={(event) =>
        setMenu({ track: current, anchor: event.currentTarget })
      }
    >
      <MoreHorizontal size={24} aria-hidden="true" />
    </button>
  );
}
