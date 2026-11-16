import BrandMark from "../brand/BrandMark";
import { Shield } from "lucide-react";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";
import { useLayoutEffect, useRef } from "react";
import { usePhoneLayout } from "../ux/usePhoneLayout";

export default function LibraryBrand() {
  const header = useRef<HTMLElement>(null);
  usePhoneLayout();
  useLayoutEffect(() => {
    const node = header.current;
    if (!node) return;
    const navigation = node
      .closest(".content-shell")
      ?.querySelector(".library-navigation");
    const measure = () => {
      const height = node.getBoundingClientRect().height;
      node
        .closest<HTMLElement>(".content-shell")
        ?.style.setProperty("--library-brand-height", `${height}px`);
      document.documentElement.style.setProperty(
        "--library-sticky-height",
        `${height + (navigation?.getBoundingClientRect().height ?? 48)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (navigation) observer.observe(navigation);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--library-sticky-height");
    };
  }, []);
  const { settings, closeGroup, motion, setSelectionMode, setSelectedIds, t } =
    useMusicAppContext();
  return (
    <header ref={header} className="library-brand-header">
      <a
        href="#"
        className="brand"
        onClick={(event) => {
          event.preventDefault();
          closeGroup();
          setSelectionMode(false);
          setSelectedIds([]);
          motion.choose("songs");
        }}
        aria-label={t.library}
      >
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span>
          local<span className="brand-period">.</span>
        </span>
      </a>
      <div className="library-brand-note">
        <span className="local-note">
          <Shield size={16} aria-hidden="true" />
          {settings?.language === "es"
            ? "Solo en tu dispositivo"
            : "Yours, on your device"}
        </span>
        {!native && (
          <span className="preview-note" title={t.previewHint}>
            {t.preview}
          </span>
        )}
      </div>
      <div id="library-header-actions" />
    </header>
  );
}
