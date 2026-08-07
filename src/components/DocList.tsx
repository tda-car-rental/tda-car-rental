import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, Eye, Plus, Trash2 } from "lucide-react";
import { deleteDoc, listDocs, type DocRow, type DocType, type Item } from "@/lib/db";
import { generatePdf } from "@/lib/pdf";

export function DocList({ docType }: { docType: DocType }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const navigate = useNavigate();

  const label = docType === "billing"
    ? "Billing"
    : docType === "quotation"
      ? "Quotation"
      : "Acknowledgement Receipt";
  const pluralLabel = docType === "billing"
    ? "Billings"
    : docType === "quotation"
      ? "Quotations"
      : "Acknowledgement Receipts";

  const refresh = useCallback(async () => {
    const all = await listDocs();
    setDocs(all.filter((doc) => doc.doc_type === docType));
  }, [docType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = () => {
    if (docType === "billing") navigate({ to: "/billing/new" });
    else if (docType === "quotation") navigate({ to: "/quotation/new" });
    else navigate({ to: "/acknowledgement-receipts/new" });
  };

  const openEdit = (id: number) => {
    if (docType === "billing") {
      navigate({ to: "/billing/$id/edit", params: { id: String(id) } });
    } else if (docType === "quotation") {
      navigate({ to: "/quotation/$id/edit", params: { id: String(id) } });
    } else {
      navigate({ to: "/acknowledgement-receipts/$id/edit", params: { id: String(id) } });
    }
  };

  const remove = async (id: number) => {
    await deleteDoc(id);
    await refresh();
  };

  const toPdfInput = (doc: DocRow) => {
    if (doc.doc_type === "acknowledgement") {
      return {
        docType: "acknowledgement" as const,
        date: doc.doc_date,
        refNo: doc.ack_ref_no,
        amount: doc.ack_amount,
        details: doc.ack_details,
        receivedBy: doc.ack_received_by,
        dateReceived: doc.ack_date_received,
      };
    }

    let items: Item[] = [];
    try {
      items = JSON.parse(doc.items_json);
    } catch {
      // Existing records may predate current validation; leave their PDF line items empty.
    }

    return {
      docType: doc.doc_type,
      date: doc.doc_date,
      billedTo: doc.billed_to,
      unit: doc.unit,
      driver: doc.driver,
      requestor: doc.requestor,
      items,
    };
  };

  const downloadDoc = async (doc: DocRow) => {
    const pdf = await generatePdf(toPdfInput(doc));
    pdf.save(`${doc.doc_type}-${doc.doc_date.replace(/\s+/g, "_")}.pdf`);
  };

  const previewDoc = async (doc: DocRow) => {
    const previewWindow = window.open("", "_blank");
    const pdf = await generatePdf(toPdfInput(doc));
    const url = pdf.output("bloburl");
    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {docs.length} {pluralLabel.toLowerCase()}
          {docs.length === 1 ? "" : "s"} saved
        </p>
        <button onClick={openCreate} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" /> Create {label}
        </button>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        {docs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No {pluralLabel.toLowerCase()} yet. Click “Create {label}” to add one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="p-3">Date</th>
                <th className="p-3">
                  {docType === "billing" ? "Billed To" : docType === "quotation" ? "Requestor" : "Ref No."}
                </th>
                <th className="p-3">{docType === "acknowledgement" ? "Received By" : "Unit"}</th>
                <th className="p-3 text-right">Total</th>
                <th className="w-32 p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr
                  key={doc.id}
                  className="cursor-pointer border-t hover:bg-muted/40"
                  onClick={() => openEdit(doc.id)}
                >
                  <td className="p-3">{doc.doc_date}</td>
                  <td className="p-3">
                    {docType === "billing"
                      ? doc.billed_to
                      : docType === "quotation"
                        ? doc.requestor
                        : doc.ack_ref_no}
                  </td>
                  <td className="p-3">{docType === "acknowledgement" ? doc.ack_received_by : doc.unit}</td>
                  <td className="p-3 text-right">
                    PHP {Number(docType === "acknowledgement" ? doc.ack_amount : doc.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => void previewDoc(doc)}
                        className="rounded p-1.5 hover:bg-accent"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void downloadDoc(doc)}
                        className="rounded p-1.5 hover:bg-accent"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(doc.id)}
                        className="rounded p-1.5 text-destructive hover:bg-accent"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
