import { useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import type { OverlayItem } from "@/lib/contract-pdf.types";
import { pdfToCanvas } from "@/lib/contract-pdf-coordinate";

type OverlayCanvasProps = {
  items: OverlayItem[];
  currentPage: number;
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  onUpdate: (id: string, patch: Partial<OverlayItem>) => void;
  onDelete: (id: string) => void;
  onSurfaceClick: (info: {
    x: number;
    y: number;
    pageNumber: number;
    viewportWidth: number;
    viewportHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => void;
  signatureDataUrl?: string;
};

type ResizeHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type MoveInteraction = {
  kind: "move";
  id: string;
  startX: number;
  startY: number;
  itemX: number;
  itemY: number;
};

type ResizeInteraction = {
  kind: "resize";
  id: string;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  item: OverlayItem;
};

type InteractionState = MoveInteraction | ResizeInteraction | null;

const minItemSize = {
  text: { width: 40, height: 20 },
  signature: { width: 60, height: 40 },
} as const;

export function OverlayCanvas({
  items,
  currentPage,
  canvasWidth,
  canvasHeight,
  viewportWidth,
  viewportHeight,
  onUpdate,
  onDelete,
  onSurfaceClick,
  signatureDataUrl,
}: OverlayCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interactionState, setInteractionState] = useState<InteractionState>(null);

  const viewport = { width: viewportWidth, height: viewportHeight };
  const pageItems = items.filter((item) => item.pageNumber === currentPage);

  const toCanvasCoords = (pdfX: number, pdfY: number) =>
    pdfToCanvas(pdfX, pdfY, viewport, canvasWidth, canvasHeight);

  const handlePointerDown = (e: ReactPointerEvent, item: OverlayItem) => {
    e.stopPropagation();
    setSelectedId(item.id);
    setInteractionState({
      kind: "move",
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      itemX: item.x,
      itemY: item.y,
    });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleResizePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, item: OverlayItem, handle: ResizeHandle) => {
    e.stopPropagation();
    setSelectedId(item.id);
    setInteractionState({
      kind: "resize",
      id: item.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      item,
    });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!interactionState) return;

    const dx = (e.clientX - interactionState.startX) * (viewportWidth / canvasWidth);
    const dy = (e.clientY - interactionState.startY) * (viewportHeight / canvasHeight);

    if (interactionState.kind === "move") {
      onUpdate(interactionState.id, {
        x: interactionState.itemX + dx,
        y: interactionState.itemY + dy,
      });
      return;
    }

    const { item, handle } = interactionState;
    const minimums = minItemSize[item.type];
    const aspectRatio = item.width / item.height;

    if (item.type === "signature") {
      const widthScale = handle.includes("left") ? (item.width - dx) / item.width : (item.width + dx) / item.width;
      const heightScale = handle.includes("top") ? (item.height - dy) / item.height : (item.height + dy) / item.height;
      const scale = Math.max(
        minimums.width / item.width,
        minimums.height / item.height,
        widthScale,
        heightScale,
      );
      const width = item.width * scale;
      const height = width / aspectRatio;
      const patch: Partial<OverlayItem> = { width, height };

      if (handle.includes("left")) {
        patch.x = item.x + (item.width - width);
      }
      if (handle.includes("top")) {
        patch.y = item.y + (item.height - height);
      }

      onUpdate(interactionState.id, patch);
      return;
    }

    let width = item.width;
    let height = item.height;
    let x = item.x;
    let y = item.y;

    if (handle.includes("right")) {
      width = Math.max(minimums.width, item.width + dx);
    }
    if (handle.includes("left")) {
      width = Math.max(minimums.width, item.width - dx);
      x = item.x + (item.width - width);
    }
    if (handle.includes("bottom")) {
      height = Math.max(minimums.height, item.height + dy);
    }
    if (handle.includes("top")) {
      height = Math.max(minimums.height, item.height - dy);
      y = item.y + (item.height - height);
    }

    onUpdate(interactionState.id, { x, y, width, height });
  };

  const handlePointerUp = () => {
    setInteractionState(null);
  };

  const handleSurfaceClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    setSelectedId(null);
    if (e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    onSurfaceClick({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pageNumber: currentPage,
      viewportWidth,
      viewportHeight,
      canvasWidth,
      canvasHeight,
    });
  };

  return (
    <div
      data-testid="overlay-surface"
      className="absolute inset-0"
      style={{ width: canvasWidth, height: canvasHeight }}
      onClick={handleSurfaceClick}
    >
      {pageItems.map((item) => {
        const pos = toCanvasCoords(item.x, item.y);
        const isSelected = item.id === selectedId;
        const showResizeHandles = isSelected;

        return (
          <div
            key={item.id}
            data-overlay-item={item.type}
            className={`absolute border ${isSelected ? "border-blue-500" : "border-transparent"} ${
              item.type === "text" ? "bg-white/80 cursor-move" : ""
            }`}
            style={{
              left: pos.x,
              top: pos.y,
              width: (item.width / viewportWidth) * canvasWidth,
              height: (item.height / viewportHeight) * canvasHeight,
            }}
            onPointerDown={(e) => handlePointerDown(e, item)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {item.type === "text" ? (
              <div
                contentEditable={isSelected}
                suppressContentEditableWarning
                className="w-full h-full p-1 text-black outline-none"
                style={{ fontSize: item.fontSize ?? 12 }}
                onBlur={(e) => onUpdate(item.id, { content: e.currentTarget.textContent ?? "" })}
              >
                {item.content}
              </div>
            ) : (
              <img
                src={signatureDataUrl}
                alt="Signature"
                className="w-full h-full object-contain pointer-events-none"
              />
            )}
            {showResizeHandles && (
              <>
                {([
                  { handle: "top-left", className: "-left-2 -top-2 cursor-nwse-resize" },
                  { handle: "top-right", className: "-right-2 -top-2 cursor-nesw-resize" },
                  { handle: "bottom-left", className: "-left-2 -bottom-2 cursor-nesw-resize" },
                  { handle: "bottom-right", className: "-right-2 -bottom-2 cursor-nwse-resize" },
                ] as const).map(({ handle, className }) => (
                  <button
                    key={handle}
                    type="button"
                    aria-label={`Resize ${handle}`}
                    className={`absolute h-3 w-3 rounded-sm border border-blue-600 bg-white ${className}`}
                    onPointerDown={(e) => handleResizePointerDown(e, item, handle)}
                  />
                ))}
              </>
            )}
            {isSelected && (
              <button
                aria-label="Delete"
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
