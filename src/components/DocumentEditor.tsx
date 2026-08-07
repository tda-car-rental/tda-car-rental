import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { generatePdf } from "@/lib/pdf";
import { getDoc, saveDoc, updateDoc, type DocType, type Item } from "@/lib/db";
import { DatePicker } from "@/components/ui/date-picker";
import type { EditorInitial } from "@/lib/document-editor-data";

function todayLong(): string {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function emptyItem(patch: Partial<Item> = {}): Item {
  return {
    date: "",
    destination: "",
    passenger: "",
    unit: "",
    amount: 0,
    ...patch,
  };
}
function rowsShare(items: Item[], field: "passenger" | "unit"): boolean {
  const first = items[0]?.[field] || "";
  return Boolean(first) && items.every((item) => item[field] === first);
}
function synchronizeRows(items: Item[], field: "passenger" | "unit"): Item[] {
  const value = items[0]?.[field] || "";
  return items.map((item) => ({ ...item, [field]: value }));
}
function documentUnitSummary(items: Item[]): string {
  if (!items.length || !items.some((item) => item.unit)) return "";
  const firstUnit = items[0].unit || "";
  return firstUnit && items.every((item) => item.unit === firstUnit) ? firstUnit : "Multiple units";
}

function documentLabel(docType: DocType): string {
  if (docType === "billing") return "Billing";
  if (docType === "quotation") return "Quotation";
  return "Acknowledgement Receipt";
}

export function DocumentEditor({
  docType,
  documentId,
  initial,
  onSaved,
}: {
  docType: DocType;
  documentId?: number;
  initial?: EditorInitial;
  onSaved?: () => void;
}) {
  const isAcknowledgement = docType === "acknowledgement";
  const [date, setDate] = useState(initial?.date ?? todayLong());
  const [billedTo, setBilledTo] = useState(initial?.billedTo ?? "");
  const [driver, setDriver] = useState(initial?.driver ?? "Teddy Dimate");
  const [requestor, setRequestor] = useState(initial?.requestor ?? "");
  const [refNo, setRefNo] = useState(initial?.refNo ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [details, setDetails] = useState(initial?.details ?? "");
  const [receivedBy, setReceivedBy] = useState(initial?.receivedBy ?? "");
  const [dateReceived, setDateReceived] = useState(initial?.dateReceived ?? todayLong());
  const initialItems = isAcknowledgement ? [] : initial?.items ?? [emptyItem()];
  const [items, setItems] = useState<Item[]>(initialItems);
  const [samePassenger, setSamePassenger] = useState(isAcknowledgement ? false : rowsShare(initialItems, "passenger"));
  const [sameUnit, setSameUnit] = useState(isAcknowledgement ? false : rowsShare(initialItems, "unit"));
  const [isSaving, setIsSaving] = useState(false);

  const total = isAcknowledgement ? Number(amount) || 0 : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const setItem = (idx: number, patch: Partial<Item>) =>
    setItems((previous) => {
      let next = previous.map((item, index) => (index === idx ? { ...item, ...patch } : item));
      if (idx === 0 && samePassenger && patch.passenger !== undefined) {
        next = synchronizeRows(next, "passenger");
      }
      if (idx === 0 && sameUnit && patch.unit !== undefined) {
        next = synchronizeRows(next, "unit");
      }
      return next;
    });
  const setSameField = (field: "passenger" | "unit", checked: boolean) => {
    if (field === "passenger") setSamePassenger(checked);
    else setSameUnit(checked);
    if (checked) setItems((previous) => synchronizeRows(previous, field));
  };
  const addRow = () =>
    setItems((previous) => [
      ...previous,
      emptyItem({
        passenger: samePassenger ? previous[0]?.passenger || "" : "",
        unit: sameUnit ? previous[0]?.unit || "" : "",
      }),
    ]);
  const removeRow = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const buildInput = () => {
    const normalizedItems = items.map((item) => ({ ...item, amount: Number(item.amount) || 0 }));
    if (isAcknowledgement) {
      return {
        docType,
        date,
        refNo,
        amount: Number(amount) || 0,
        details,
        receivedBy,
        dateReceived,
      };
    }

    return {
      docType,
      date,
      billedTo,
      unit: documentUnitSummary(normalizedItems),
      driver,
      requestor: docType === "quotation" ? requestor : "",
      items: normalizedItems,
    };
  };

  const preview = async () => {
    const previewWindow = window.open("", "_blank");
    const pdf = await generatePdf(buildInput());
    const url = String(pdf.output("bloburl"));
    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.open(url, "_blank");
    }
  };
  const download = async () => {
    const pdf = await generatePdf(buildInput());
    pdf.save(`${docType}-${date.replace(/\s+/g, "_")}.pdf`);
  };
  const save = async () => {
    setIsSaving(true);
    try {
      const normalizedItems = items.map((item) => ({ ...item, amount: Number(item.amount) || 0 }));
      const draft = isAcknowledgement
        ? {
            doc_type: docType,
            doc_date: date,
            billed_to: "",
            unit: "",
            driver: "",
            requestor: "",
            total: Number(amount) || 0,
            items_json: JSON.stringify([]),
            ack_ref_no: refNo,
            ack_amount: Number(amount) || 0,
            ack_details: details,
            ack_received_by: receivedBy,
            ack_date_received: dateReceived,
          }
        : {
            doc_type: docType,
            doc_date: date,
            billed_to: billedTo,
            unit: documentUnitSummary(normalizedItems),
            driver,
            requestor: docType === "quotation" ? requestor : "",
            total,
            items_json: JSON.stringify(normalizedItems),
            ack_ref_no: "",
            ack_amount: 0,
            ack_details: "",
            ack_received_by: "",
            ack_date_received: "",
          };
      const savedId = documentId === undefined ? await saveDoc(draft) : documentId;
      if (documentId !== undefined) {
        await updateDoc(documentId, draft);
      }
      const savedDoc = await getDoc(savedId);
      if (!savedDoc || savedDoc.doc_type !== docType) {
        throw new Error("We couldn't confirm the document was saved to the desktop database.");
      }
      toast.success(`${documentLabel(docType)} saved.`);
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed. Please try again.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <DatePicker
            value={date}
            onChange={setDate}
            format="d MMMM yyyy"
            ariaLabel="Document date"
          />
        </Field>
        {isAcknowledgement ? (
          <>
            <Field label="Ref No.">
              <input className="input" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
            </Field>
            <Field label="Date Received">
              <DatePicker
                value={dateReceived}
                onChange={setDateReceived}
                format="d MMMM yyyy"
                ariaLabel="Date received"
              />
            </Field>
            <Field label="Amount">
              <input
                className="input"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Received by">
              <input className="input" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Details">
                <textarea
                  className="input min-h-28"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Easy Park office to Park Inn Hotel, Clark"
                />
              </Field>
            </div>
          </>
        ) : (
          <>
            {docType === "billing" ? (
              <>
                <Field label="Billed To">
                  <input
                    className="input"
                    value={billedTo}
                    onChange={(e) => setBilledTo(e.target.value)}
                    placeholder="Path Foundation"
                  />
                </Field>
                <Field label="Driver">
                  <input className="input" value={driver} onChange={(e) => setDriver(e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="Requestor">
                <input
                  className="input"
                  value={requestor}
                  onChange={(e) => setRequestor(e.target.value)}
                  placeholder="Path Foundation"
                />
              </Field>
            )}
          </>
        )}
      </div>

      {!isAcknowledgement && (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="font-semibold">Line Items</h2>
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={samePassenger}
                  onChange={(e) => setSameField("passenger", e.target.checked)}
                />
                Same passenger?
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={sameUnit}
                  onChange={(e) => setSameField("unit", e.target.checked)}
                />
                Same unit?
              </label>
            </div>
          </div>
          <button
            onClick={addRow}
            className="text-sm px-3 py-1.5 rounded-md bg-secondary hover:bg-accent"
          >
            + Add row
          </button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left w-28">Date</th>
                <th className="p-2 text-left w-32">Unit</th>
                <th className="p-2 text-left">Destination</th>
                <th className="p-2 text-left w-36">Passenger</th>
                <th className="p-2 text-right w-32">Amount (PHP)</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">
                    <DatePicker
                      value={it.date}
                      onChange={(v) => setItem(i, { date: v })}
                      format="dd-MMM-yy"
                      ariaLabel={`Item date ${i + 1}`}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      aria-label={`Unit ${i + 1}`}
                      className="input"
                      value={it.unit || ""}
                      disabled={sameUnit && i > 0}
                      onChange={(e) => setItem(i, { unit: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <textarea
                      className="input min-h-[38px]"
                      value={it.destination}
                      onChange={(e) => setItem(i, { destination: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      aria-label={`Passenger ${i + 1}`}
                      className="input"
                      value={it.passenger}
                      disabled={samePassenger && i > 0}
                      onChange={(e) => setItem(i, { passenger: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      className="input text-right"
                      type="number"
                      step="0.01"
                      value={it.amount}
                      onChange={(e) => setItem(i, { amount: Number(e.target.value) })}
                    />
                  </td>
                  <td className="p-1 text-center">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-destructive hover:opacity-70"
                      title="Remove"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right text-sm">
          <span className="text-muted-foreground">Total: </span>
          <span className="font-semibold">
            PHP {total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap gap-2 border-t bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <button onClick={() => void preview()} className="btn-primary" disabled={isSaving}>
          Preview PDF
        </button>
        <button onClick={() => void download()} className="btn-primary" disabled={isSaving}>
          Download PDF
        </button>
        <button onClick={() => void save()} className="btn-secondary" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
