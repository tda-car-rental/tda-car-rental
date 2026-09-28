import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiDocumentation } from "@/components/admin/ApiDocumentation";

describe("ApiDocumentation", () => {
  it("renders safe operation documentation without execution controls or secrets", () => {
    render(<ApiDocumentation />);
    expect(screen.getByText("API Documentation")).toBeInTheDocument();
    expect(screen.getAllByText("/workspace-context")).toHaveLength(2);
    expect(screen.getByText("Bearer access token required.")).toBeInTheDocument();
    expect(screen.getByText(/does not execute requests/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try it out/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/service_role|DOCUMENT_ENCRYPTION_KEY|SUPABASE_DB_URL/i)).not.toBeInTheDocument();
  });
});
