// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartupController } from "@/electron/main/startup-controller.js";

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("StartupController", () => {
  afterEach(() => vi.useRealTimers());

  it("does not show a startup failure until five full minutes elapse", async () => {
    vi.useFakeTimers();
    const showTimeout = vi.fn();
    const controller = new StartupController({
      startServer: vi.fn(() => ({ kill: vi.fn() })),
      isReachable: vi.fn().mockResolvedValue(false),
      loadApplication: vi.fn(),
      showLoading: vi.fn(),
      showTimeout,
    });

    await controller.start();
    await vi.advanceTimersByTimeAsync(299_999);
    expect(showTimeout).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(showTimeout).toHaveBeenCalledTimes(1);
  });

  it("stops the stale server and resets the deadline when retried", async () => {
    vi.useFakeTimers();
    const firstServer = { kill: vi.fn() };
    const secondServer = { kill: vi.fn() };
    const startServer = vi.fn().mockReturnValueOnce(firstServer).mockReturnValueOnce(secondServer);
    const showTimeout = vi.fn();
    const controller = new StartupController({
      startServer,
      isReachable: vi.fn().mockResolvedValue(false),
      loadApplication: vi.fn(),
      showLoading: vi.fn(),
      showTimeout,
    });

    await controller.start();
    await vi.advanceTimersByTimeAsync(299_999);
    await controller.retry();

    expect(firstServer.kill).toHaveBeenCalledTimes(1);
    expect(startServer).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(299_999);
    expect(showTimeout).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(showTimeout).toHaveBeenCalledTimes(1);
  });

  it("stops polling after the application loads successfully", async () => {
    vi.useFakeTimers();
    const isReachable = vi.fn().mockResolvedValue(true);
    const loadApplication = vi.fn().mockResolvedValue(undefined);
    const showTimeout = vi.fn();
    const controller = new StartupController({
      startServer: vi.fn(() => ({ kill: vi.fn() })),
      isReachable,
      loadApplication,
      showLoading: vi.fn(),
      showTimeout,
    });

    await controller.start();
    await flush();
    await flush();
    expect(loadApplication).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(isReachable).toHaveBeenCalledTimes(1);
    expect(showTimeout).not.toHaveBeenCalled();
  });

  it("returns to loading and keeps retrying after navigation fails", async () => {
    vi.useFakeTimers();
    const showLoading = vi.fn();
    const controller = new StartupController({
      startServer: vi.fn(() => ({ kill: vi.fn() })),
      isReachable: vi.fn().mockResolvedValue(true),
      loadApplication: vi.fn().mockRejectedValue(new Error("navigation failed")),
      showLoading,
      showTimeout: vi.fn(),
    });

    await controller.start();
    await flush();
    await flush();
    expect(showLoading).toHaveBeenCalledTimes(2);
  });

  it("restarts the local server after a controlled spawn failure", async () => {
    vi.useFakeTimers();
    const startServer = vi
      .fn()
      .mockImplementationOnce(() => { throw new Error("spawn failed"); })
      .mockImplementationOnce(() => ({ kill: vi.fn() }));
    const controller = new StartupController({
      startServer,
      isReachable: vi.fn().mockResolvedValue(false),
      loadApplication: vi.fn(),
      showLoading: vi.fn(),
      showTimeout: vi.fn(),
    });

    await controller.start();
    expect(startServer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(startServer).toHaveBeenCalledTimes(2);
  });
});
