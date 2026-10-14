import { FREQUENCIES, type PersonalSession } from "./types";

/** Temporary display of the current adjustment, never a persisted response. */
export function setupPreview(
  session: PersonalSession,
  reference?: number,
  pendingNo = false,
) {
  const left = [...(session.left ?? Array(10).fill(0))];
  const right = [...(session.right ?? Array(10).fill(0))];
  if (session.phase !== "test") return { left, right };
  const level = Math.min(-36, session.level + (pendingNo ? 6 : 0));
  if (level > -54) {
    const index = FREQUENCIES.findIndex((f) => f === session.frequency);
    if (index >= 0) {
      const curve = session.ear === 0 ? left : right;
      curve[index] = Math.max(0, Math.min(6, level - (reference ?? -54)));
    }
  }
  return { left, right };
}
