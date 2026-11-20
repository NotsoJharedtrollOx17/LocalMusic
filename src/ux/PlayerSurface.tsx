import { usePlayerArtworkSize } from "./usePlayerArtworkSize";
import { useFocusScope } from "./useFocusScope";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { IconButton } from "../components";
import { useBackLayer } from "../navigation";
import { reducedMotion } from "./motion";
import { animateCover } from "./motion";
import { useAndroidPlayerMotion } from "./useAndroidPlayerMotion";
import { useGestureCancellation } from "./useGestureCancellation";

export function PlayerSurface({
  standalone = false,
  title,
  closeLabel,
  view,
  onView,
  onClose,
  children,
  footer,
  headerAction,
  trackId,
  active = true,
  preview = false,
}: {
  standalone?: boolean;
  title: string;
  closeLabel: string;
  view: "player" | "queue";
  onView: (view: "player" | "queue") => void;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  headerAction?: ReactNode;
  trackId: string;
  active?: boolean;
  preview?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closing = useRef(false),
    drag = useRef<{ id: number; x: number; y: number; t: number; vertical: boolean } | null>(null);
  const bodyDrag =
    view === "player" &&
    document.documentElement.dataset.platform !== "android";
  const android = document.documentElement.dataset.platform === "android";
  const androidMotion = android && !standalone && view === "player";
  usePlayerArtworkSize(ref, active || preview, view, trackId);
  const transition = useAndroidPlayerMotion(ref, androidMotion, active, preview, trackId, onClose);
  const latestClose = useRef(onClose);
  const entryAnimation = useRef<Animation | null>(null);
  const exitAnimation = useRef<Animation | null>(null),
    exitCover = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      entryAnimation.current?.cancel();
      exitAnimation.current?.cancel();
      exitCover.current?.();
    },
    [],
  );
  latestClose.current = onClose;
  const collapse = () => {
    if (standalone) {
      latestClose.current();
      return;
    }
    if (closing.current) return;
    closing.current = true;
    if (androidMotion) {
      transition.close();
      return;
    }
    const node = ref.current;
    if (!node || reducedMotion()) {
      latestClose.current();
      return;
    }
    const art = node.querySelector<HTMLImageElement>(".player-cover"),
      mini = document.querySelector<HTMLImageElement>(".mini-track .cover");
    if (!android && art && mini)
      exitCover.current = animateCover(
        art.getBoundingClientRect(),
        mini.getBoundingClientRect(),
        art.src,
      );
    const startTransform = getComputedStyle(node).transform;
    entryAnimation.current?.cancel();
    node.inert = true;
    const animation = node.animate(
          [
            { transform: startTransform, opacity: 1 },
            { transform: "translateY(45px) scale(.97)", opacity: 0 },
          ],
      {
        duration: 240,
        easing: "cubic-bezier(.4,0,.2,1)",
        fill: "forwards",
      },
    );
    exitAnimation.current = animation;
    animation.finished.then(
      () => {
        if (ref.current === node) latestClose.current();
      },
      () => {},
    );
  };
  useBackLayer(active || preview, () =>
    preview ? transition.cancelPreview() :
    view === "queue" ? onView("player") : collapse(),
  );
  useFocusScope(ref, active && !standalone);
  const entered = useRef(false);
  useLayoutEffect(() => {
    if (!active || view !== "player" || entered.current) return;
    entered.current = true;
    if (android) return;
    const mini = document.querySelector<HTMLImageElement>(".mini-track .cover"),
      art = ref.current?.querySelector<HTMLImageElement>(".player-cover");
    if (mini && art)
      return animateCover(
        mini.getBoundingClientRect(),
        art.getBoundingClientRect(),
        art.src,
      );
  }, [trackId, active]);
  const down = (e: ReactPointerEvent) => {
    if (standalone || (android && view !== "player") || closing.current ||
        !e.isPrimary || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button,input,select,a")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), vertical: false };
    if (e.nativeEvent.isTrusted) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const y = Math.max(0, e.clientY - g.y);
    if (androidMotion) {
      if (y > 12 && y > Math.abs(e.clientX - g.x) * 1.5) g.vertical = true;
      if (g.vertical) transition.move(y);
      return;
    }
    if (ref.current && !reducedMotion() && !android)
      ref.current.style.transform = `translateY(${Math.min(y, 250)}px)`;
  };
  const up = (e: ReactPointerEvent) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const y = e.clientY - g.y,
      elapsed = performance.now() - g.t;
    drag.current = null;
    if ((!androidMotion || g.vertical) &&
        (y > 100 || (y > 30 && y / Math.max(1, elapsed) > 0.6))) collapse();
    else if (androidMotion && g.vertical) transition.release(false);
    else if (ref.current) ref.current.style.transform = "";
  };
  const cancelDrag = () => {
    if (!drag.current) return;
    const vertical = drag.current.vertical;
    drag.current = null;
    if (androidMotion && vertical) transition.release(false);
    else if (ref.current) ref.current.style.transform = "";
  };
  useGestureCancellation(cancelDrag, trackId);
  return (
    <div
      className={"player-scrim" + (standalone ? " standalone-player" : "")}
      hidden={!active && !preview}
      inert={!active}
      aria-hidden={!active || undefined}
      data-player-preview={preview || undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) collapse();
      }}
    >
      <div
        ref={ref}
        className={
          "player-surface" + (view === "player" ? " now-playing-surface" : "")
        }
        role="dialog"
        aria-modal={standalone ? undefined : true}
        aria-label={title}
      >
        {androidMotion && <div className="android-player-backdrop" aria-hidden="true" />}
        <header
          className="player-surface-head"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
        >
          <IconButton label={closeLabel} onClick={collapse}>
            {standalone ? <ArrowLeft /> : <ChevronDown />}
          </IconButton>
          <h2>{title}</h2>
          {headerAction}
        </header>
        <div
          className={"player-surface-body " + view}
          key={view}
          onPointerDown={bodyDrag ? down : undefined}
          onPointerMove={bodyDrag ? move : undefined}
          onPointerUp={bodyDrag ? up : undefined}
          onPointerCancel={cancelDrag}
        >
          {children}
        </div>
        <div className="player-surface-footer">{footer}</div>
      </div>
    </div>
  );
}
