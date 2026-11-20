import { createContext, useRef, useState } from "react";

export function useAndroidPlayerDrag() {
  const [previewTrack, setPreviewTrack] = useState<string | null>(null);
  const distance = useRef(0);
  const receiver = useRef<((distance: number | null) => void) | null>(null);
  const clear = () => {
    distance.current = 0;
    setPreviewTrack(null);
  };
  return {
    previewTrack,
    distance,
    receiver,
    move(trackId: string, pixels: number) {
      distance.current = pixels;
      if (receiver.current) receiver.current(pixels);
      else setPreviewTrack(trackId);
    },
    cancel() {
      if (receiver.current) receiver.current(null);
      else clear();
    },
    clear,
  };
}

export const AndroidPlayerDrag = createContext<ReturnType<typeof useAndroidPlayerDrag> | null>(null);
