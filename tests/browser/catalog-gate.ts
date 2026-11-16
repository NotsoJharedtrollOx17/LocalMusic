import type { Page } from "@playwright/test";
/** Hold one real catalog read: the metadata validation read when warm, or rows when cold. */
export async function holdNextTrackRead(
  page: Page,
  target: "catalog" | "track" | "recap" = "catalog",
  triggerButton?: string,
) {
  await page.evaluate(({ target, triggerButton }) => {
    const state = window as unknown as {
      catalogReadHeld: boolean;
      releaseCatalog: () => void;
      stopHoldingCatalog: () => void;
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
    state.stopHoldingCatalog = restore;
    state.releaseCatalog = () => {
      restore();
      resume();
    };
    const hold = <T>(request: IDBRequest<T>) => {
      state.catalogReadHeld = true;
      if (target !== "recap") restore();
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
      return target === "recap" && this.name === "intervals"
        ? hold(request)
        : target === "catalog" &&
        this.name === "tracks" &&
        this.transaction.objectStoreNames.length === 1
        ? hold(request)
        : request;
    };
    IDBObjectStore.prototype.get = function (...args) {
      const request = originalGet.apply(this, args);
      return (target === "track"
        ? this.name === "tracks"
        : target === "catalog" && this.name === "settings" && args[0] === "catalog-revision") &&
        this.transaction.mode === "readonly"
        ? hold(request)
        : request;
    };
    // Arm and trigger within one task so ordinary playback polling cannot
    // consume this one-shot interception between separate driver commands.
    if (triggerButton) {
      const button = Array.from(document.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === triggerButton,
      );
      if (!button) throw new Error(`Missing gate trigger: ${triggerButton}`);
      button.click();
    }
  }, { target, triggerButton });
}
export async function release(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { releaseCatalog: () => void }).releaseCatalog(),
  );
}
