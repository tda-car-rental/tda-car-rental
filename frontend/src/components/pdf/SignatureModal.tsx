import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Trash2 } from "lucide-react";

type SignatureModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dataUrl: string) => void | Promise<void>;
  defaultSignatureUrl?: string;
};

export function SignatureModal({ open, onOpenChange, onConfirm, defaultSignatureUrl }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [activeTab, setActiveTab] = useState<"draw" | "upload" | "default">("draw");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCanvasCtx = useCallback(() => {
    return canvasRef.current?.getContext("2d") ?? null;
  }, []);

  useEffect(() => {
    if (open) {
      setHasDrawn(false);
      setActiveTab(defaultSignatureUrl ? "default" : "draw");
      setUploadPreview(null);
      setIsConfirming(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [open, defaultSignatureUrl]);

  useEffect(() => {
    if (open) return;

    document.body.style.pointerEvents = "";
    document.body.removeAttribute("data-scroll-locked");

    return () => {
      document.body.style.pointerEvents = "";
      document.body.removeAttribute("data-scroll-locked");
    };
  }, [open]);

  const startDraw = (e: React.PointerEvent) => {
    if (activeTab !== "draw") return;
    const ctx = getCanvasCtx();
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || activeTab !== "draw") return;
    const ctx = getCanvasCtx();
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
      setActiveTab("upload");
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    let signatureValue: string | null = null;
    if (activeTab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      signatureValue = canvas.toDataURL("image/png");
    } else if (activeTab === "upload" && uploadPreview) {
      signatureValue = uploadPreview;
    } else if (activeTab === "default" && defaultSignatureUrl) {
      signatureValue = defaultSignatureUrl;
    }
    if (!signatureValue) return;
    setIsConfirming(true);
    try {
      await onConfirm(signatureValue);
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const canConfirm =
    (activeTab === "draw" && hasDrawn) ||
    (activeTab === "upload" && uploadPreview) ||
    (activeTab === "default" && defaultSignatureUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Signature</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b">
          {defaultSignatureUrl && (
            <button
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "default"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("default")}
            >
              Default
            </button>
          )}
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "draw"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("draw")}
          >
            Draw
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "upload"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("upload")}
          >
            Upload
          </button>
        </div>

        <div className="flex justify-center py-4">
          {activeTab === "default" && defaultSignatureUrl && (
            <img src={defaultSignatureUrl} alt="Default signature" className="max-h-24 object-contain" />
          )}

          {activeTab === "draw" && (
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="border rounded-md bg-white cursor-crosshair"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={stopDraw}
                onPointerLeave={stopDraw}
              />
              {hasDrawn && (
                <button
                  onClick={clearCanvas}
                  className="absolute top-2 right-2 p-1 rounded bg-muted hover:bg-muted/80"
                  aria-label="Clear signature"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleUpload}
              />
              {uploadPreview ? (
                <div className="space-y-2">
                  <img src={uploadPreview} alt="Uploaded signature" className="max-h-24 object-contain" />
                  <button
                    onClick={() => {
                      setUploadPreview(null);
                      fileInputRef.current?.click();
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Choose different image
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-8 border-2 border-dashed rounded-lg hover:bg-muted/50"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload signature image</span>
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="btn-secondary" disabled={isConfirming}>
            Cancel
          </button>
          <button onClick={() => void handleConfirm()} disabled={!canConfirm || isConfirming} className="btn-primary disabled:opacity-50">
            {isConfirming ? "Preparing..." : "Use Signature"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
