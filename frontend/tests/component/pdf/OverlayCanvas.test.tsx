import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OverlayCanvas } from "@/components/pdf/OverlayCanvas";
import type { OverlayItem } from "@/lib/contract-pdf.types";

describe("OverlayCanvas", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders text overlay items", () => {
    const items: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "Hello",
        fontSize: 12,
      },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders signature overlay items", () => {
    const items: OverlayItem[] = [
      {
        id: "sig-1",
        type: "signature",
        pageNumber: 0,
        x: 300,
        y: 400,
        width: 120,
        height: 80,
      },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        signatureDataUrl="data:image/png;base64,abc"
      />,
    );

    expect(screen.getByRole("img", { name: /signature/i })).toBeInTheDocument();
  });

  it("only shows items for the current page", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 0, y: 0, width: 100, height: 20, content: "Page 0" },
      { id: "2", type: "text", pageNumber: 1, x: 0, y: 0, width: 100, height: 20, content: "Page 1" },
    ];

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Page 0")).toBeInTheDocument();
    expect(screen.queryByText("Page 1")).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 0, y: 0, width: 100, height: 20, content: "Delete me" },
    ];
    const onDelete = vi.fn();

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    // Click the item container to select it (via pointerDown)
    const itemContainer = screen.getByText("Delete me").parentElement!;
    fireEvent.pointerDown(itemContainer, { clientX: 0, clientY: 0 });

    // Click delete button
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("moves overlays in the same vertical direction as the drag", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 100, y: 200, width: 100, height: 20, content: "Drag me" },
    ];
    const onUpdate = vi.fn();

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        onSurfaceClick={vi.fn()}
      />,
    );

    const itemContainer = screen.getByText("Drag me").parentElement!;
    fireEvent.pointerDown(itemContainer, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(itemContainer, { clientX: 100, clientY: 150, pointerId: 1 });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toBe("1");
    expect(onUpdate.mock.calls[0][1].x).toBe(100);
    expect(onUpdate.mock.calls[0][1].y).toBeCloseTo(200 + (50 * 792) / 1040, 6);
  });

  it("resizes text overlays freely from the bottom-right handle", () => {
    const items: OverlayItem[] = [
      { id: "1", type: "text", pageNumber: 0, x: 100, y: 200, width: 100, height: 20, content: "Resize me" },
    ];
    const onUpdate = vi.fn();

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        onSurfaceClick={vi.fn()}
      />,
    );

    const itemContainer = screen.getByText("Resize me").parentElement!;
    fireEvent.pointerDown(itemContainer, { clientX: 100, clientY: 100, pointerId: 1 });

    const handle = screen.getByLabelText("Resize bottom-right");
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 250, clientY: 260, pointerId: 2 });

    expect(onUpdate).toHaveBeenCalledWith(
      "1",
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
    expect(onUpdate.mock.calls.at(-1)?.[1].width).toBeGreaterThan(100);
    expect(onUpdate.mock.calls.at(-1)?.[1].height).toBeGreaterThan(20);
  });

  it("keeps signature aspect ratio while resizing", () => {
    const items: OverlayItem[] = [
      { id: "sig-1", type: "signature", pageNumber: 0, x: 100, y: 200, width: 120, height: 80 },
    ];
    const onUpdate = vi.fn();

    render(
      <OverlayCanvas
        items={items}
        currentPage={0}
        canvasWidth={800}
        canvasHeight={1040}
        viewportWidth={612}
        viewportHeight={792}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        onSurfaceClick={vi.fn()}
        signatureDataUrl="data:image/png;base64,abc"
      />,
    );

    const signature = screen.getByRole("img", { name: /signature/i }).parentElement!;
    fireEvent.pointerDown(signature, { clientX: 100, clientY: 100, pointerId: 1 });

    const handle = screen.getByLabelText("Resize bottom-right");
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 260, clientY: 220, pointerId: 2 });

    const patch = onUpdate.mock.calls.at(-1)?.[1];
    expect(patch.width).toBeGreaterThan(120);
    expect(patch.height).toBeCloseTo((patch.width * 80) / 120, 6);
  });
});
