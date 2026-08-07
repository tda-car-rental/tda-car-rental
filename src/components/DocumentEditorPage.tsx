import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DocumentEditor } from "@/components/DocumentEditor";
import { getDoc, type DocType } from "@/lib/db";
import { toEditorInitial, type EditorInitial } from "@/lib/document-editor-data";

type EditorStatus = "loading" | "ready" | "unavailable";

export function DocumentEditorPage({
  docType,
  documentId,
}: {
  docType: DocType;
  documentId?: number;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<EditorStatus>(
    documentId === undefined ? "ready" : "loading",
  );
  const [initial, setInitial] = useState<EditorInitial | undefined>();
  const label = docType === "billing" ? "Billing" : docType === "quotation" ? "Quotation" : "Acknowledgement Receipt";
  const title = `${documentId === undefined ? "Create" : "Edit"} ${label}`;

  const returnToList = () => {
    if (docType === "billing") navigate({ to: "/billing" });
    else if (docType === "quotation") navigate({ to: "/quotation" });
    else navigate({ to: "/acknowledgement-receipts" });
  };

  useEffect(() => {
    if (documentId === undefined) {
      setInitial(undefined);
      setStatus("ready");
      return;
    }

    let active = true;
    setStatus("loading");

    getDoc(documentId)
      .then((doc) => {
        const editorInitial = doc?.doc_type === docType ? toEditorInitial(doc) : null;
        if (!active) return;

        if (!editorInitial) {
          setStatus("unavailable");
          return;
        }

        setInitial(editorInitial);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, [docType, documentId]);

  return (
    <AppLayout title={title}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {documentId === undefined ? "New document" : "Update saved document"}
            </p>
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          <button onClick={returnToList} className="btn-secondary">
            Cancel
          </button>
        </div>

        {status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading document...</p>
        )}

        {status === "unavailable" && (
          <div className="rounded-md border bg-card p-6">
            <h2 className="font-semibold">This document is unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been deleted or contains invalid line items.
            </p>
            <button onClick={returnToList} className="btn-primary mt-4">
              Back to {label}s
            </button>
          </div>
        )}

        {status === "ready" && (
          <DocumentEditor
            docType={docType}
            documentId={documentId}
            initial={initial}
            onSaved={returnToList}
          />
        )}
      </div>
    </AppLayout>
  );
}
