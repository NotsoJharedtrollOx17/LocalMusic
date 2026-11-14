import { useEffect, useRef, useState } from "react";
import { usePhoneLayout } from "../ux/usePhoneLayout";

/** Prefetch one page per scope/progress; stalled requests require explicit retry. */
export default function LibraryPageBoundary({
  progress,
  loading,
  onLoad,
  label,
  retry,
}: {
  progress: string;
  loading: boolean;
  onLoad: () => unknown;
  label: string;
  retry: string;
}) {
  const phone = usePhoneLayout(),
    node = useRef<HTMLDivElement>(null),
    latest = useRef(onLoad),
    busy = useRef(false),
    attempted = useRef<string | undefined>(undefined);
  const [finished, setFinished] = useState<string | null>(null);
  latest.current = onLoad;
  const automatic = phone && typeof IntersectionObserver !== "undefined";
  const stalled = finished === progress && !loading;
  const run = async (force = false) => {
    if (busy.current || loading || (!force && attempted.current === progress))
      return;
    busy.current = true;
    attempted.current = progress;
    setFinished(null);
    try {
      await latest.current();
    } catch {
      /* Existing controller error handling remains authoritative. */
    } finally {
      busy.current = false;
      setFinished(progress);
    }
  };
  const trigger = useRef(run);
  trigger.current = run;
  useEffect(() => {
    if (!automatic || loading || stalled || !node.current) return;
    let root: HTMLElement | null = node.current.parentElement;
    while (
      root &&
      root !== document.body &&
      !/(auto|scroll)/.test(getComputedStyle(root).overflowY)
    )
      root = root.parentElement;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!document.hidden && entries.some((e) => e.isIntersecting))
          void trigger.current();
      },
      { root: root === document.body ? null : root, rootMargin: "900px 0px" },
    );
    const target = node.current;
    observer.observe(target);
    const resume = () => {
      if (!document.hidden) {
        observer.unobserve(target);
        observer.observe(target);
      }
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [automatic, loading, progress, finished, stalled]);
  return (
    <div ref={node} className="library-page-boundary">
      {(!automatic || stalled) && (
        <button
          className="button secondary load-more"
          disabled={loading}
          onClick={() => void run(true)}
        >
          {stalled ? retry : label}
        </button>
      )}
    </div>
  );
}
