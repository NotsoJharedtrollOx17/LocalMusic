import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { RecapKind, RecapRequest, Settings } from "../types";
import { localDate, periodFor } from "../recap/periods";

export function useRecapPeriods(
  settings: Settings | undefined,
  setSettings: Dispatch<SetStateAction<Settings | undefined>>,
  selection: RecapRequest,
  setSelection: Dispatch<SetStateAction<RecapRequest>>,
  snapshotMode: boolean,
  setSnapshotMode: Dispatch<SetStateAction<boolean>>,
) {
  const [clock, setClock] = useState(() => new Date());
  const initialized = useRef(false);
  useEffect(() => {
    const update = () => {
      if (!document.hidden) setClock(new Date());
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    const timer = window.setInterval(update, 60000);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!settings || snapshotMode) return;
    const kind = initialized.current
      ? selection.kind
      : (settings.recapPeriod ?? "year");
    initialized.current = true;
    const current = periodFor({
      kind,
      anchorDate: localDate(clock, settings.timeZone),
    });
    setSelection((s) =>
      s.kind === current.kind && s.anchorDate === current.startDate
        ? s
        : { kind, anchorDate: current.startDate },
    );
  }, [
    settings?.timeZone,
    Boolean(settings),
    selection.kind,
    clock,
    snapshotMode,
  ]);
  function currentSelection(kind: RecapKind): RecapRequest {
    return {
      kind,
      anchorDate: periodFor({
        kind,
        anchorDate: localDate(new Date(), settings!.timeZone),
      }).startDate,
    };
  }
  function returnToLive() {
    if (!settings) return;
    setSelection(currentSelection(selection.kind));
    setSnapshotMode(false);
  }
  function chooseKind(kind: RecapKind) {
    if (!settings) return;
    setSelection(currentSelection(kind));
    setSnapshotMode(false);
    setSettings((s) => (s ? { ...s, recapPeriod: kind } : s));
  }
  return { chooseKind, returnToLive };
}
