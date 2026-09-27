export type StartupServer = {
  kill(): unknown;
};

export type StartupClock = {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
};

export type StartupControllerDependencies = {
  startServer(): StartupServer;
  isReachable(): Promise<boolean>;
  loadApplication(): Promise<void>;
  showLoading(): Promise<void> | void;
  showTimeout(): Promise<void> | void;
  clock?: StartupClock;
  retryIntervalMs?: number;
  timeoutMs?: number;
};

const defaultClock: StartupClock = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timer) => clearTimeout(timer),
};

export class StartupController {
  private readonly clock: StartupClock;
  private readonly retryIntervalMs: number;
  private readonly timeoutMs: number;
  private run = 0;
  private state: "idle" | "polling" | "loaded" | "timed-out" | "disposed" = "idle";
  private server: StartupServer | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly dependencies: StartupControllerDependencies) {
    this.clock = dependencies.clock ?? defaultClock;
    this.retryIntervalMs = dependencies.retryIntervalMs ?? 2_000;
    this.timeoutMs = dependencies.timeoutMs ?? 5 * 60_000;
  }

  async start(): Promise<void> {
    this.run += 1;
    const run = this.run;
    this.stopTimers();
    this.stopServer();
    this.state = "polling";

    try {
      await this.dependencies.showLoading();
    } catch {
      // The loading page may already be active; continue attempting startup.
    }
    if (!this.isPolling(run)) return;

    this.ensureServer();
    this.deadlineTimer = this.clock.setTimeout(() => void this.timeout(run), this.timeoutMs);
    void this.poll(run);
  }

  async retry(): Promise<void> {
    await this.start();
  }

  dispose(): void {
    this.run += 1;
    this.state = "disposed";
    this.stopTimers();
    this.stopServer();
  }

  private isPolling(run: number): boolean {
    return this.run === run && this.state === "polling";
  }

  private ensureServer(): void {
    if (this.server) return;
    try {
      this.server = this.dependencies.startServer();
    } catch {
      // Startup failures are retried until the five-minute deadline.
    }
  }

  private async poll(run: number): Promise<void> {
    let reachable = false;
    try {
      reachable = await this.dependencies.isReachable();
    } catch {
      // The local server may not have bound its port yet.
    }
    if (!this.isPolling(run)) return;

    if (reachable) {
      try {
        await this.dependencies.loadApplication();
        if (!this.isPolling(run)) return;
        this.state = "loaded";
        this.stopTimers();
        return;
      } catch {
        // A failed navigation is retried just like a pending server.
        try {
          await this.dependencies.showLoading();
        } catch {
          // The next retry still has a chance to reach the app page.
        }
      }
    }
    if (!this.isPolling(run)) return;
    this.retryTimer = this.clock.setTimeout(() => {
      this.ensureServer();
      void this.poll(run);
    }, this.retryIntervalMs);
  }

  private async timeout(run: number): Promise<void> {
    if (!this.isPolling(run)) return;
    this.state = "timed-out";
    this.clearRetryTimer();
    try {
      await this.dependencies.showTimeout();
    } catch {
      // The static timeout page is best-effort during application shutdown.
    }
  }

  private stopTimers(): void {
    this.clearRetryTimer();
    if (this.deadlineTimer) this.clock.clearTimeout(this.deadlineTimer);
    this.deadlineTimer = undefined;
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) this.clock.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }

  private stopServer(): void {
    if (!this.server) return;
    try {
      this.server.kill();
    } catch {
      // The process may already have exited.
    }
    this.server = undefined;
  }
}
