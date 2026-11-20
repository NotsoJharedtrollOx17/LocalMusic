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
}) {
  const ref = useRef<HTMLDivElement>(null),
    closing = useRef(false),
    drag = useRef<{ y: number; t: number } | null>(null);
  const bodyDrag =
    view === "player" &&
    document.documentElement.dataset.platform !== "android";
  const android = document.documentElement.dataset.platform === "android";
  usePlayerArtworkSize(ref, active, view, trackId);
  const latestClose = useRef(onClose);
  const entryAnimation = useRef<Animation | null>(null);
  const miniOffset = (node: HTMLElement) => {
    const mini = document.querySelector(".mini-player")?.getBoundingClientRect();
    const bounds = node.getBoundingClientRect();
    return `translateY(${Math.max(0, (mini?.top ?? bounds.bottom) - bounds.top)}px)`;
  };
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
    const endTransform = miniOffset(node);
    entryAnimation.current?.cancel();
    node.inert = true;
    if (android) node.dataset.closing = "true";
    const animation = node.animate(
      android
        ? [
            { transform: startTransform },
            { transform: endTransform },
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
  useBackLayer(active, () =>
    view === "queue" ? onView("player") : collapse(),
  );
  useFocusScope(ref, active && !standalone);
  const entered = useRef(false);
  useLayoutEffect(() => {
    if (!active || view !== "player" || entered.current) return;
    entered.current = true;
    if (android) {
      const node = ref.current;
      if (node && !standalone && !reducedMotion())
        entryAnimation.current = node.animate(
          [{ transform: miniOffset(node) }, { transform: "translateY(0)" }],
          { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      return;
    }
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
    if (standalone) return;
    if ((e.target as HTMLElement).closest("button,input,select,a")) return;
    drag.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const y = Math.max(0, e.clientY - drag.current.y);
    if (ref.current && !reducedMotion() && !android)
      ref.current.style.transform = `translateY(${Math.min(y, 250)}px)`;
  };
  const up = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const y = e.clientY - drag.current.y,
      elapsed = performance.now() - drag.current.t;
    drag.current = null;
    if (y > 100 || (y > 30 && y / Math.max(1, elapsed) > 0.6)) collapse();
    else if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div
      className={"player-scrim" + (standalone ? " standalone-player" : "")}
      hidden={!active}
      inert={!active}
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
        <header
          className="player-surface-head"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            drag.current = null;
            if (ref.current) ref.current.style.transform = "";
          }}
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
          onPointerCancel={() => {
            drag.current = null;
            if (ref.current) ref.current.style.transform = "";
          }}
        >
          {children}
        </div>
        <div className="player-surface-footer">{footer}</div>
      </div>
    </div>
  );
}
