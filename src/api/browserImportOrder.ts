import { baseAlbumId } from "../library/identity";
import type { Track } from "../types";
export type OrderedTrack = Track & { importSequence?: number };

/** Legacy preview tracks remain older than all newly tracked imports. */
export async function ensureImportOrder(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["tracks", "settings"], "readwrite"),
      store = tx.objectStore("tracks"),
      read = store.getAll(),
      settings = tx.objectStore("settings"),
      counter = settings.get("catalog-import-sequence");
    let completed = 0;
    const syncCounter = () => {
      if (++completed !== 2) return;
      const maximum = (read.result as OrderedTrack[]).reduce(
        (max, track) => Math.max(max, track.importSequence ?? 0),
        Number(counter.result ?? 0),
      );
      settings.put(maximum, "catalog-import-sequence");
    };
    counter.onsuccess = syncCounter;
    read.onsuccess = () => {
      const unknown = (read.result as OrderedTrack[]).filter(
        (t) => t.importSequence === undefined,
      );
      syncCounter();
      (read.result as OrderedTrack[])
        .filter((t) => !t.sourceAlbumId)
        .forEach((t) =>
          store.put({ ...t, sourceAlbumId: baseAlbumId(t) }, t.id),
        );
      unknown.forEach((track, index) =>
        store.put(
          {
            ...track,
            sourceAlbumId: track.sourceAlbumId ?? baseAlbumId(track),
            importSequence: index - unknown.length,
          },
          track.id,
        ),
      );
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function putImportedTrack<T extends Track>(
  db: IDBDatabase,
  track: T,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["tracks", "settings"], "readwrite"),
      tracks = tx.objectStore("tracks"),
      settings = tx.objectStore("settings");
    const existing = tracks.get(track.id),
      counter = settings.get("catalog-import-sequence");
    let reads = 0;
    const save = () => {
      if (++reads !== 2) return;
      const old = existing.result as OrderedTrack | undefined;
      const sequence = old?.importSequence ?? Number(counter.result ?? 0) + 1;
      if (old?.importSequence === undefined)
        settings.put(sequence, "catalog-import-sequence");
      tracks.put(
        {
          ...track,
          sourceAlbumId:
            old?.sourceAlbumId ?? (old ? baseAlbumId(old) : baseAlbumId(track)),
          importSequence: sequence,
        },
        track.id,
      );
      const revision = settings.get("catalog-revision");
      revision.onsuccess = () =>
        settings.put(Number(revision.result ?? 0) + 1, "catalog-revision");
    };
    existing.onsuccess = save;
    counter.onsuccess = save;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
