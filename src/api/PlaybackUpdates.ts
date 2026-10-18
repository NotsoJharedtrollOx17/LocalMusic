import type { PlaybackSnapshot } from "../types";

/** Keep native push events, polling and seek acknowledgements in order. */
export class PlaybackUpdates {
  private listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  private revision = 0;
  private seekRevision = 0;
  private seeking = 0;

  add(listener: (snapshot: PlaybackSnapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private publish(snapshot: PlaybackSnapshot) {
    this.listeners.forEach((listener) => listener(snapshot));
  }
  push(snapshot: PlaybackSnapshot) {
    this.revision++;
    if (!this.seeking) this.publish(snapshot);
  }
  async poll(read: () => Promise<PlaybackSnapshot>) {
    const revision = this.revision;
    const snapshot = await read();
    if (revision === this.revision && !this.seeking) this.publish(snapshot);
  }
  async seek(
    change: () => Promise<void>,
    read: () => Promise<PlaybackSnapshot>,
  ) {
    const requested = ++this.seekRevision;
    this.revision++;
    this.seeking++;
    try {
      await change();
      const snapshot = await read();
      // Publish the authoritative position before releasing the slider preview.
      if (requested === this.seekRevision) this.publish(snapshot);
    } finally {
      this.seeking--;
      this.revision++;
    }
  }
}
