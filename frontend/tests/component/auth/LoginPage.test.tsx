import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/components/auth/LoginPage";

describe("LoginPage", () => {
  it("submits the standard email and password fields", async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    render(<LoginPage onSignIn={onSignIn} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith("owner@example.com", "password"));
  });

  it("shows the supplied error without account enumeration", () => {
    render(<LoginPage onSignIn={vi.fn()} error="Sign-in failed." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in failed.");
    expect(screen.queryByText(/user not found|incorrect password/i)).not.toBeInTheDocument();
  });
});
