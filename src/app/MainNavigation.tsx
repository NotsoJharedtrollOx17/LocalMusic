import { Music2 } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function MainNavigation() {
  const {
    setSection,
    setSelectionMode,
    setSelectedIds,
    motion,
    t,
    closeGroup,
  } = useMusicAppContext();
  return (
    <button
      className="selected"
      onClick={() => {
        setSelectionMode(false);
        setSelectedIds([]);
        closeGroup();
        motion.choose("songs");
        setSection("songs");
      }}
    >
      <Music2 />
      <span>{t.library}</span>
    </button>
  );
}
