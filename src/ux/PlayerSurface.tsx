import { usePlayerArtworkSize } from "./usePlayerArtworkSize";
import { useFocusScope } from "./useFocusScope";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { IconButton } from "../components";
import { useBackLayer } from "../navigation";
import { reducedMotion } from "./motion";
import { animateCover } from "./motion";

export function PlayerSurface({
  title,
  closeLabel,
  queueLabel,
  playerLabel,
  view,
  onView,
  onClose,
  children,
  footer,
  trackId,
  active = true,
}: {
  title: string;
  closeLabel: string;
  queueLabel: string;
  playerLabel: string;
  view: "player" | "queue";
  onView: (view: "player" | "queue") => void;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  trackId: string;
  active?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closing = useRef(false),
    drag = useRef<{ y: number; t: number } | null>(null);
  usePlayerArtworkSize(ref, active, view, trackId);
  const latestClose = useRef(onClose);
  const exitAnimation = useRef<Animation | null>(null),
    exitCover = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      exitAnimation.current?.cancel();
      exitCover.current?.();
    },
    [],
  );
  latestClose.current = onClose;
  const collapse = () => {
    if (closing.current) return;
    closing.current = true;
    const node = ref.current;
    if (!node || reducedMotion()) {
      latestClose.current();
      return;
    }
    const art = node.querySelector<HTMLImageElement>(".player-cover"),
      mini = document.querySelector<HTMLImageElement>(".mini-track .cover");
    if (art && mini)
      exitCover.current = animateCover(
        art.getBoundingClientRect(),
        mini.getBoundingClientRect(),
        art.src,
      );
    node.inert = true;
    const animation = node.animate(
      [
        { transform: getComputedStyle(node).transform, opacity: 1 },
        { transform: "translateY(45px) scale(.97)", opacity: 0 },
      ],
      { duration: 240, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
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
  useFocusScope(ref, false, active);
  const entered = useRef(false);
  useLayoutEffect(() => {
    if (!active || view !== "player" || entered.current) return;
    entered.current = true;
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
    if ((e.target as HTMLElement).closest("button,input,select,a")) return;
    drag.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const y = Math.max(0, e.clientY - drag.current.y);
    if (ref.current && !reducedMotion())
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
      className="player-scrim"
      hidden={!active}
      inert={!active}
      onClick={(e) => {
        if (e.target === e.currentTarget) collapse();
      }}
    >
      <div
        ref={ref}
        className="player-surface"
        role="dialog"
        aria-modal="true"
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
            <ChevronDown />
          </IconButton>
          <h2>{title}</h2>
          <button
            className="text-button"
            onClick={() => onView(view === "queue" ? "player" : "queue")}
          >
            {view === "queue" ? playerLabel : queueLabel}
          </button>
        </header>
        <div
          className={"player-surface-body " + view}
          key={view}
          onPointerDown={view === "player" ? down : undefined}
          onPointerMove={view === "player" ? move : undefined}
          onPointerUp={view === "player" ? up : undefined}
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
