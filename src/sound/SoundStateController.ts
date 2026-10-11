import { defaultSound } from "./model";
import type { SoundAction, SoundConfig, SoundState } from "./types";

type Backend = {
  soundCapabilities(): Promise<SoundState>;
  setSound(config: SoundConfig): Promise<SoundState>;
  soundAction(action: SoundAction): Promise<SoundState>;
};
/** Serial mutations; a read begun before an edit can never replace it. */
export class SoundStateController {
  private value = {
    state: undefined as SoundState | undefined,
    draft: defaultSound(),
    pending: false,
    acting: false,
    loading: false,
    error: "",
  };
  private listeners = new Set<() => void>();
  private acknowledged = this.value.draft;
  private revision = 0;
  private readVersion = 0;
  private queued: { config: SoundConfig; revision: number } | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private tail: Promise<void> = Promise.resolve();
  private mutations = 0;
  private actions = 0;
  private bypassIntent = false;
  constructor(private backend: Backend) {}
  snapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<typeof this.value>) {
    this.value = { ...this.value, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private accept(state: SoundState) {
    this.acknowledged = state.config;
    this.bypassIntent = state.bypass;
    this.publish({ state, draft: state.config, error: "" });
  }
  private enqueue(work: () => Promise<void>) {
    this.mutations++;
    this.publish({ pending: true });
    this.tail = this.tail.then(work).finally(() => {
      this.mutations--;
      this.publish({ pending: !!this.queued || this.mutations > 0 });
    });
    return this.tail;
  }
  edit = (update: (config: SoundConfig) => SoundConfig) => {
    if (!this.value.state || this.actions) return;
    const config = update(this.value.draft);
    this.queued = { config, revision: ++this.revision };
    this.publish({ draft: config, pending: true });
    if (!this.timer)
      this.timer = setTimeout(() => {
        void this.flush();
      }, 50);
  };
  flush = () => {
    clearTimeout(this.timer);
    this.timer = undefined;
    const write = this.queued;
    this.queued = null;
    if (write)
      this.enqueue(async () => {
        try {
          const state = await this.backend.setSound(write.config);
          this.acknowledged = state.config;
          if (write.revision === this.revision) this.accept(state);
        } catch (error) {
          if (write.revision === this.revision)
            this.publish({ draft: this.acknowledged, error: String(error) });
        }
      });
    return this.tail;
  };
  refresh = async () => {
    await this.flush();
    if (this.mutations || this.queued) return;
    const revision = this.revision,
      read = ++this.readVersion;
    if (!this.value.state) this.publish({ loading: true });
    try {
      const state = await this.backend.soundCapabilities();
      if (
        revision === this.revision &&
        read === this.readVersion &&
        !this.mutations &&
        !this.queued
      )
        this.accept(state);
    } catch (error) {
      if (revision === this.revision && read === this.readVersion)
        this.publish({ error: String(error) });
    } finally {
      if (read === this.readVersion) this.publish({ loading: false });
    }
  };
  action = (action: SoundAction) => {
    void this.flush();
    const revision = ++this.revision;
    if (action.op === "bypass") this.bypassIntent = action.value;
    this.actions++;
    this.publish({ acting: true });
    return this.enqueue(async () => {
      try {
        const state = await this.backend.soundAction(action);
        this.acknowledged = state.config;
        if (revision === this.revision) this.accept(state);
      } catch (error) {
        if (revision === this.revision) {
          this.bypassIntent = this.value.state?.bypass ?? false;
          this.publish({ draft: this.acknowledged, error: String(error) });
        }
      } finally {
        this.actions--;
        this.publish({ acting: this.actions > 0 });
      }
    });
  };
  clearBypass = () => {
    if (this.bypassIntent) void this.action({ op: "bypass", value: false });
  };
}
