import type { RankingInput } from "./rank.worker";
import type { personalized } from "./rank";
export async function browserRanking(
  input: RankingInput,
): Promise<ReturnType<typeof personalized>> {
  const worker = new Worker(new URL("./rank.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Playlist generation timed out. Try again.")),
        30000,
      );
      worker.onmessage = (e) => {
        clearTimeout(timeout);
        e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Playlist generation failed. Try again."));
      };
      worker.postMessage(input);
    });
  } finally {
    worker.terminate();
  }
}
