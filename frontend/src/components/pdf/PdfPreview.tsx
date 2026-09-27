import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PageClickInfo = {
  x: number;
  y: number;
  pageNumber: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

type PdfPreviewProps = {
  pdfBytes: Uint8Array;
  onPageClick: (info: PageClickInfo) => void;
  onPageChange?: (pageNumber: number) => void;
  onViewportChange?: (info: Omit<PageClickInfo, "x" | "y">) => void;
  children?: ReactNode;
};

export function PdfPreview({ pdfBytes, onPageClick, onPageChange, onViewportChange, children }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      setStatus("loading");
      setViewport(null);
      setTotalPages(0);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        let doc;
        try {
          doc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        } catch {
          doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(), disableWorker: true }).promise;
        }
        if (cancelled) return;
        pdfRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(0);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        pdfRef.current = null;
        setStatus("error");
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [pdfBytes, onPageChange]);

  useEffect(() => {
    let cancelled = false;
    const renderPage = async () => {
      const doc = pdfRef.current;
      const canvas = canvasRef.current;
      const surface = surfaceRef.current;
      if (!doc || !canvas || !surface || status !== "ready") return;

      const page = await doc.getPage(currentPage + 1);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const maxWidth = Math.max((surface.clientWidth || 0) - 32, 320);
      const scale = maxWidth / baseViewport.width;
      const vp = page.getViewport({ scale });

      canvas.width = vp.width;
      canvas.height = vp.height;
      setViewport({ width: baseViewport.width, height: baseViewport.height });
      onViewportChange?.({
        pageNumber: currentPage,
        viewportWidth: baseViewport.width,
        viewportHeight: baseViewport.height,
        canvasWidth: vp.width,
        canvasHeight: vp.height,
      });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    };
    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, totalPages, status, onViewportChange]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport) return;
    const rect = canvas.getBoundingClientRect();
    onPageClick({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pageNumber: currentPage,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          aria-label="Previous page"
          onClick={() => setCurrentPage((p) => {
            const next = Math.max(0, p - 1);
            onPageChange?.(next);
            return next;
          })}
          disabled={currentPage === 0}
          className="btn-secondary disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm">
          {status === "loading"
            ? "Loading PDF..."
            : status === "error"
              ? "Unable to load PDF"
              : `Page ${currentPage + 1} of ${totalPages}`}
        </span>
        <button
          aria-label="Next page"
          onClick={() => setCurrentPage((p) => {
            const next = Math.min(totalPages - 1, p + 1);
            onPageChange?.(next);
            return next;
          })}
          disabled={status !== "ready" || currentPage >= totalPages - 1}
          className="btn-secondary disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={surfaceRef}
        data-testid="pdf-preview-surface"
        className="w-full overflow-auto rounded-lg border bg-muted/20 p-4"
      >
        <div className="relative mx-auto w-fit max-w-full">
          <canvas
            ref={canvasRef}
            role="img"
            onClick={handleClick}
            className="block max-w-full cursor-crosshair border bg-white shadow-sm"
          />
          {children}
        </div>
      </div>
    </div>
  );
}
