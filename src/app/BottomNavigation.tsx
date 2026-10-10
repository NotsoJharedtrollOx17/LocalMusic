import { useMusicAppContext } from "./MusicAppContext";
import MainNavigation from "./MainNavigation";

export default function BottomNavigation() {
  const { chooserOpen } = useMusicAppContext();

  return (
    <nav
      className="bottom-nav"
      aria-label="Mobile navigation"
      inert={chooserOpen}
    >
      <MainNavigation />
    </nav>
  );
}
