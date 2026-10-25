import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { RecapKind, RecapRequest, Settings } from "../types";
import { localDate, periodFor, periodOptions } from "../recap/periods";

export function useRecapPeriods(
  settings: Settings | undefined,
  setSettings: Dispatch<SetStateAction<Settings | undefined>>,
  selection: RecapRequest,
  setSelection: Dispatch<SetStateAction<RecapRequest>>,
  snapshotMode: boolean,
  setSnapshotMode: Dispatch<SetStateAction<boolean>>,
) {
  const [clock, setClock] = useState(() => new Date());
  const initialized = useRef(false),
    followsCurrent = useRef(true);
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
  const options = useMemo(
    () => (settings ? periodOptions(selection.kind, settings, clock) : []),
    [selection.kind, settings?.timeZone, settings?.historyEnabledSince, clock],
  );
  const current = options[0];
  useEffect(() => {
    if (!settings || snapshotMode) return;
    if (!initialized.current) {
      initialized.current = true;
      const initial = periodFor({
        kind: settings.recapPeriod ?? "year",
        anchorDate: localDate(clock, settings.timeZone),
      });
      setSelection((s) =>
        s.kind === initial.kind && s.anchorDate === initial.startDate
          ? s
          : { kind: initial.kind, anchorDate: initial.startDate },
      );
      return;
    }
    const selected = periodFor(selection);
    if (
      current &&
      (followsCurrent.current ||
        !options.some((p) => p.startDate === selected.startDate))
    )
      setSelection((s) =>
        s.anchorDate === current.startDate
          ? s
          : { kind: s.kind, anchorDate: current.startDate },
      );
  }, [
    settings?.timeZone,
    settings?.historyEnabledSince,
    Boolean(settings),
    selection,
    clock,
    snapshotMode,
    current?.startDate,
    options,
  ]);
  function choosePeriod(next: RecapRequest) {
    const period = periodFor(next);
    followsCurrent.current =
      period.startDate === current?.startDate && period.kind === current?.kind;
    setSnapshotMode(false);
    setSelection({ kind: next.kind, anchorDate: period.startDate });
  }
  function chooseKind(kind: RecapKind) {
    if (!settings) return;
    followsCurrent.current = true;
    setSnapshotMode(false);
    setSelection({
      kind,
      anchorDate: periodFor({
        kind,
        anchorDate: localDate(new Date(), settings.timeZone),
      }).startDate,
    });
    setSettings((s) => (s ? { ...s, recapPeriod: kind } : s));
  }
  return {
    periodOptions: options,
    currentPeriod: current,
    choosePeriod,
    chooseKind,
  };
}
