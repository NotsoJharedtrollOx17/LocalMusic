import { createContext, useContext } from "react";
import type { useMusicApp } from "./useMusicApp";
export type MusicAppModel = ReturnType<typeof useMusicApp>;
export const MusicAppContext = createContext<MusicAppModel | null>(null);
export function useMusicAppContext() {
  const model = useContext(MusicAppContext);
  if (!model) throw Error("MusicAppContext is missing");
  return model;
}
