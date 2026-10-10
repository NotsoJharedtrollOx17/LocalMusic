import { Settings2 } from "lucide-react";
import { IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function MobileHeader() {
  const { setModal, t } = useMusicAppContext();

  return (
    <header className="mobile-brand">
      <span className="brand">
        local<span className="brand-period">.</span>
      </span>
      <IconButton label={t.settings} onClick={() => setModal("settings")}>
        <Settings2 size={20} />
      </IconButton>
    </header>
  );
}
