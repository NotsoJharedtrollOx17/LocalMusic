import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import LoadingIndicator from "../components/LoadingIndicator";
import { useMusicAppContext } from "./MusicAppContext";

export default function SearchTriggerIcon() {
  const { inlineSearch, t } = useMusicAppContext();
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    setShowLoading(false);
    if (!inlineSearch.pending) return;
    const timer = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(timer);
  }, [inlineSearch.pending]);
  return inlineSearch.pending && showLoading ? (
    <LoadingIndicator label={t.searching} compact />
  ) : (
    <Search size={25} />
  );
}
