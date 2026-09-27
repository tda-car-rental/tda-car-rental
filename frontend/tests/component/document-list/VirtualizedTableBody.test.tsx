import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualizedTableBody } from "@/components/VirtualizedTableBody";

describe("VirtualizedTableBody", () => {
  it("renders only a bounded visible window for large document lists", () => {
    const rows = Array.from({ length: 100_000 }, (_, index) => index);
    render(
      <table>
        <VirtualizedTableBody
          items={rows}
          rowHeight={40}
          viewportHeight={200}
          renderRow={(value) => <tr key={value}><td>Document {value}</td></tr>}
        />
      </table>,
    );

    expect(screen.getAllByRole("row").length).toBeLessThan(30);
    expect(screen.getByText("Document 0")).toBeInTheDocument();
    fireEvent.scroll(screen.getByTestId("virtualized-table-viewport"), { target: { scrollTop: 80_000 } });
    expect(screen.getByText("Document 2000")).toBeInTheDocument();
  });
});
