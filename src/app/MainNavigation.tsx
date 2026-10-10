import { Music2, ChartNoAxesColumn } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function MainNavigation() {
  const {
    tab,
    setTab,
    setSelectionMode,
    setSelectedIds,
    query,
    t,
    act,
    refresh,
    closeGroup,
  } = useMusicAppContext();

  return (
    <>
      <button
        className={tab === "library" ? "selected" : ""}
        onClick={() => {
          setSelectionMode(false);
          setSelectedIds([]);
          setTab("library");
          closeGroup();
          void act(() => refresh(query));
        }}
      >
        <Music2 />
        <span>{t.library}</span>
      </button>
      <button
        className={tab === "year" ? "selected" : ""}
        onClick={() => {
          setSelectionMode(false);
          setSelectedIds([]);
          setTab("year");
        }}
      >
        <ChartNoAxesColumn />
        <span>{t.year}</span>
      </button>
    </>
  );
}
