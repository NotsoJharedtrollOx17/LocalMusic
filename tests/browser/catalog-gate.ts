import type { Page } from "@playwright/test";
/** Hold one real catalog read: the metadata validation read when warm, or rows when cold. */
export async function holdNextTrackRead(page: Page) {
  await page.evaluate(() => {
    const state = window as unknown as {
      catalogReadHeld: boolean;
      releaseCatalog: () => void;
    };
    state.catalogReadHeld = false;
    const originalAll = IDBObjectStore.prototype.getAll,
      originalGet = IDBObjectStore.prototype.get;
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const restore = () => {
      IDBObjectStore.prototype.getAll = originalAll;
      IDBObjectStore.prototype.get = originalGet;
    };
    state.releaseCatalog = () => {
      restore();
      resume();
    };
    const hold = <T>(request: IDBRequest<T>) => {
      state.catalogReadHeld = true;
      restore();
      request.addEventListener(
        "success",
        (event) => {
          event.stopImmediatePropagation();
          void gate.then(() => request.onsuccess?.call(request, event));
        },
        { once: true },
      );
      return request;
    };
    IDBObjectStore.prototype.getAll = function (...args) {
      const request = originalAll.apply(this, args);
      return this.name === "tracks" &&
        this.transaction.objectStoreNames.length === 1
        ? hold(request)
        : request;
    };
    IDBObjectStore.prototype.get = function (...args) {
      const request = originalGet.apply(this, args);
      return this.name === "settings" &&
        args[0] === "catalog-revision" &&
        this.transaction.mode === "readonly"
        ? hold(request)
        : request;
    };
  });
}
export async function release(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { releaseCatalog: () => void }).releaseCatalog(),
  );
}
