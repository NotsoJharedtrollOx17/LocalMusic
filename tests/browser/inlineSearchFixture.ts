import { expect, type Page } from "@playwright/test";
import { taggedWav } from "./fixtures";
export async function seedInlineCatalog(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Songs", exact: true }).waitFor();
  const wav = [...taggedWav("Fixture", 0, 1)];
  await page.evaluate(async (wav) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["tracks", "playlists"], "readwrite");
      for (let i = 0; i < 130; i++) {
        const id = `entry-${i}`;
        tx.objectStore("tracks").put(
          {
            id,
            title:
              i === 1
                ? "Needle first"
                : i === 129
                  ? "Needle last"
                  : `Song ${String(i).padStart(3, "0")}`,
            artist: `Person ${String(i).padStart(3, "0")}`,
            album: `Record ${String(i).padStart(3, "0")}`,
            sourceUri: `/fixture/${id}`,
            genre: "",
            available: true,
            favorite: i === 129,
            durationMs: 1000,
            file: new Blob([new Uint8Array(wav)], { type: "audio/wav" }),
            orderMetadataRead: true,
            releaseMetadataRead: true,
            importSequence: i,
          },
          id,
        );
      }
      tx.objectStore("playlists").put(
        {
          id: "mix",
          title: "Needle playlist",
          kind: "manual",
          trackIds: ["entry-0", "entry-1", "entry-2", "entry-129"],
        },
        "mix",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, wav);
  await page.reload();
  await expect(page.getByText("130 songs", { exact: true })).toBeVisible();
}
