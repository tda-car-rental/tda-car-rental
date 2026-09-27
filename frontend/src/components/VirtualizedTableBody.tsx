import { useMemo, useState, type ReactNode } from "react";

export function VirtualizedTableBody<T>({
  items,
  rowHeight,
  viewportHeight,
  renderRow,
}: {
  items: T[];
  rowHeight: number;
  viewportHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const overscan = 8;
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const count = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const visible = useMemo(() => items.slice(first, first + count), [count, first, items]);

  return (
    <>
      <tr>
        <td colSpan={5} className="p-0">
          <div
            data-testid="virtualized-table-viewport"
            className="max-h-[32rem] overflow-y-auto"
            style={{ height: viewportHeight }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            <div style={{ height: items.length * rowHeight, position: "relative" }}>
              <table className="absolute inset-x-0 top-0 w-full text-sm" style={{ transform: `translateY(${first * rowHeight}px)` }}>
                <tbody>{visible.map((item, index) => renderRow(item, first + index))}</tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
