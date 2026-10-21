import { Heart } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";

export default function EmptyFavorites() {
  const { t, setOnlyFavorites } = useMusicAppContext();
  return (
    <div className="empty-small empty-favorites">
      <Heart aria-hidden="true" />
      <h3>{t.emptyFavorites}</h3>
      <p>{t.emptyFavoritesHint}</p>
      <button
        className="button secondary"
        onClick={() => setOnlyFavorites(false)}
      >
        {t.allMusic}
      </button>
    </div>
  );
}
