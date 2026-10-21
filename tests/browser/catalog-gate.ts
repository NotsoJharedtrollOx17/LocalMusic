import type { Page } from "@playwright/test";
export async function holdNextTrackRead(page: Page) {
  await page.evaluate(() => {
    const state = window as unknown as { catalogReadHeld: boolean };
    state.catalogReadHeld = false;
    const original = IDBObjectStore.prototype.getAll;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { releaseCatalog: () => void }).releaseCatalog =
      release;
    IDBObjectStore.prototype.getAll = function (...args) {
      const request = original.apply(this, args);
      if (this.name === "tracks") {
        state.catalogReadHeld = true;
        IDBObjectStore.prototype.getAll = original;
        request.addEventListener(
          "success",
          (event) => {
            event.stopImmediatePropagation();
            void gate.then(() => request.onsuccess?.call(request, event));
          },
          { once: true },
        );
      }
      return request;
    };
  });
}

export async function release(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { releaseCatalog: () => void }).releaseCatalog(),
  );
}
