import type { Page } from "@playwright/test";
/** Delay the first matching worker reply, rather than relying on uncached IDB reads. */
export async function installSearchGate(page: Page, query: string) {
  await page.addInitScript((query) => {
    const Base = window.Worker;
    (window as any).searchHeld = false;
    window.Worker = class extends Base {
      private heldId?: number;
      private heldEvent?: MessageEvent;
      private released = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes("catalog.worker")) {
          this.addEventListener("message", (event) => {
            if (!this.released && event.data.id === this.heldId) {
              event.stopImmediatePropagation();
              this.heldEvent = event;
              (window as any).searchHeld = true;
            }
          });
          (window as any).releaseSearch = () => {
            this.released = true;
            if (this.heldEvent)
              this.dispatchEvent(
                new MessageEvent("message", { data: this.heldEvent.data }),
              );
          };
        }
      }
      postMessage(message: any, transfer: any = []) {
        if (message.query === query) this.heldId = message.id;
        super.postMessage(message, transfer);
      }
    };
  }, query);
}
export async function releaseSearch(page: Page) {
  await page.evaluate(() => (window as any).releaseSearch());
}
