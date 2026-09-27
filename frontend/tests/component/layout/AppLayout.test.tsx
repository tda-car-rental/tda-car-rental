import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: "/contracts" } }),
}));

import { AppLayout } from "@/components/AppLayout";

describe("AppLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses a fixed-height shell with a scrollable main pane", () => {
    const { container } = render(
      <AppLayout title="Contracts">
        <div>Content</div>
      </AppLayout>,
    );

    const shell = container.firstElementChild;
    const main = screen.getByRole("main");

    expect(shell).toHaveClass("h-screen");
    expect(shell).toHaveClass("overflow-hidden");
    expect(main).toHaveClass("overflow-auto");
  });
});
