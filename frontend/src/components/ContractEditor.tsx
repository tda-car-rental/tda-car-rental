import { useCallback, useRef, useState } from "react";
import { Download, Type, Pen } from "lucide-react";
import { toast } from "sonner";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { OverlayCanvas } from "@/components/pdf/OverlayCanvas";
import { SignatureModal } from "@/components/pdf/SignatureModal";
import { exportContractPdf } from "@/lib/contract-pdf";
import { canvasToPdf } from "@/lib/contract-pdf-coordinate";
import type { OverlayItem } from "@/lib/contract-pdf.types";
import { electronApi } from "@/lib/electron-api";

const signatureAssets = import.meta.glob("../../signature/*.{png,PNG}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const defaultSignatureUrl = Object.entries(signatureAssets).find(([path]) => path.toLowerCase().endsWith(".png"))?.[1];

async function toDataUrl(url: string): Promise<string> {
  const resolvedUrl =
    url.startsWith("data:") || /^[a-z]+:/i.test(url) ? url : new URL(url, window.location.href).toString();
  const res = await fetch(resolvedUrl);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const ext = url.endsWith(".jpg") || url.endsWith(".jpeg") ? "jpeg" : "png";
  return `data:image/${ext};base64,${btoa(binary)}`;
}

export function ContractEditor() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [mode, setMode] = useState<"select" | "text" | "signature">("select");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageInfo, setPageInfo] = useState<{
    viewportWidth: number;
    viewportHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  } | null>(null);
  const [fontSize, setFontSize] = useState(12);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [activeSignatureUrl, setActiveSignatureUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const modeRef = useRef<"select" | "text" | "signature">("select");
  const activeSignatureUrlRef = useRef<string | null>(null);

  const updateMode = useCallback((nextMode: "select" | "text" | "signature") => {
    modeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const updateActiveSignatureUrl = useCallback((nextSignatureUrl: string | null) => {
    activeSignatureUrlRef.current = nextSignatureUrl;
    setActiveSignatureUrl(nextSignatureUrl);
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setPdfBytes(bytes);
    setOverlays([]);
    setCurrentPage(0);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleSignatureConfirm = useCallback(async (dataUrl: string) => {
    const normalizedSignatureUrl = dataUrl.startsWith("data:image/")
      ? dataUrl
      : await toDataUrl(dataUrl);
    updateActiveSignatureUrl(normalizedSignatureUrl);
    updateMode("signature");
  }, [updateActiveSignatureUrl, updateMode]);

  const handlePageClick = useCallback(
    (info: {
      x: number;
      y: number;
      pageNumber: number;
      viewportWidth: number;
      viewportHeight: number;
      canvasWidth: number;
      canvasHeight: number;
    }) => {
      const viewport = { width: info.viewportWidth, height: info.viewportHeight };
      const pdfCoords = canvasToPdf(info.x, info.y, viewport, info.canvasWidth, info.canvasHeight);

      if (modeRef.current === "text") {
        const newItem: OverlayItem = {
          id: crypto.randomUUID(),
          type: "text",
          pageNumber: info.pageNumber,
          x: pdfCoords.x,
          y: pdfCoords.y,
          width: 150,
          height: 20,
          content: "",
          fontSize,
        };
        setOverlays((prev) => [...prev, newItem]);
        updateMode("select");
      } else if (modeRef.current === "signature" && activeSignatureUrlRef.current) {
        const newItem: OverlayItem = {
          id: crypto.randomUUID(),
          type: "signature",
          pageNumber: info.pageNumber,
          x: pdfCoords.x,
          y: pdfCoords.y,
          width: 120,
          height: 80,
        };
        setOverlays((prev) => [...prev, newItem]);
        updateMode("select");
      }
    },
    [fontSize, updateMode],
  );

  const handleViewportChange = useCallback((info: {
    pageNumber: number;
    viewportWidth: number;
    viewportHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => {
    setCurrentPage(info.pageNumber);
    setPageInfo({
      viewportWidth: info.viewportWidth,
      viewportHeight: info.viewportHeight,
      canvasWidth: info.canvasWidth,
      canvasHeight: info.canvasHeight,
    });
  }, []);

  const handleUpdate = useCallback((id: string, patch: Partial<OverlayItem>) => {
    setOverlays((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!pdfBytes) return;
    setIsDownloading(true);
    try {
      const signatureDataUrl = activeSignatureUrl ?? (defaultSignatureUrl ? await toDataUrl(defaultSignatureUrl) : undefined);
      const bytes = await exportContractPdf({ pdfBytes, overlays, signatureDataUrl });
      const result = await electronApi().files.savePdf({
        defaultFileName: "contract-signed.pdf",
        bytes,
      });
      if (!result.canceled) {
        toast.success("Contract PDF downloaded.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Contract download failed. Please try again.";
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  }, [pdfBytes, overlays, activeSignatureUrl]);

  return (
    <div className="space-y-4">
      {!pdfBytes ? (
        <label className="block border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-accent">
          <input
            type="file"
            accept=".pdf"
            className="sr-only"
            aria-label="Upload PDF contract"
            onChange={handleFileChange}
          />
          <p className="text-muted-foreground">Drop a PDF or click to browse</p>
        </label>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => updateMode("select")}
              className={`btn-secondary ${mode === "select" ? "bg-accent" : ""}`}
            >
              Select
            </button>
            <button
              onClick={() => updateMode("text")}
              className={`btn-secondary ${mode === "text" ? "bg-accent" : ""}`}
            >
              <Type className="h-4 w-4 mr-1" /> Add Text
            </button>
            <button
              onClick={() => setSignatureModalOpen(true)}
              className={`btn-secondary ${mode === "signature" ? "bg-accent" : ""}`}
            >
              <Pen className="h-4 w-4 mr-1" /> Add Signature
            </button>
            <label className="flex items-center gap-1 text-sm ml-4">
              Size:
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min={6}
                max={72}
                className="w-16 input"
              />
            </label>
            <button onClick={() => void handleDownload()} className="btn-primary ml-auto" disabled={isDownloading}>
              <Download className="h-4 w-4 mr-1" /> {isDownloading ? "Downloading..." : "Download"}
            </button>
          </div>

          <PdfPreview
            pdfBytes={pdfBytes}
            onPageClick={handlePageClick}
            onPageChange={handlePageChange}
            onViewportChange={handleViewportChange}
          >
            {pageInfo && (
              <OverlayCanvas
                items={overlays}
                currentPage={currentPage}
                canvasWidth={pageInfo.canvasWidth}
                canvasHeight={pageInfo.canvasHeight}
                viewportWidth={pageInfo.viewportWidth}
                viewportHeight={pageInfo.viewportHeight}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSurfaceClick={handlePageClick}
                signatureDataUrl={activeSignatureUrl ?? undefined}
              />
            )}
          </PdfPreview>

          <SignatureModal
            open={signatureModalOpen}
            onOpenChange={setSignatureModalOpen}
            onConfirm={handleSignatureConfirm}
            defaultSignatureUrl={defaultSignatureUrl}
          />
        </>
      )}
    </div>
  );
}
