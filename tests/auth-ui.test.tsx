// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { safeReturnTo } from "@/features/auth/navigation";
import { authErrorMessage, registrationSchema } from "@/features/auth/schemas";

const authMocks = vi.hoisted(() => ({
  signInCustomer: vi.fn(),
  registerCustomer: vi.fn(),
  signInWithGoogle: vi.fn(),
  requestPasswordReset: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: authMocks.replace, refresh: authMocks.refresh }),
}));
vi.mock("@/features/auth/client", () => authMocks);
import { AuthForm } from "@/features/auth/auth-form";
import { ResetPasswordForm } from "@/features/auth/reset-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("safe authentication navigation", () => {
  it("allows intended local routes and rejects open redirects", () => {
    expect(safeReturnTo("/checkout")).toBe("/checkout");
    expect(safeReturnTo("/account/orders/order-123")).toBe("/account/orders/order-123");
    expect(safeReturnTo("/admin/products")).toBe("/admin/products");
    for (const input of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/api/auth/session",
      "/%2f%2fevil.example",
      "/unknown",
      ["/checkout"],
    ])
      expect(safeReturnTo(input)).toBe("/account");
  });
  it("requires matching strong-enough passwords and maps provider failures", () => {
    expect(
      registrationSchema.safeParse({
        name: "Ian",
        email: "ian@example.test",
        password: "short",
        confirmPassword: "different",
      }).success,
    ).toBe(false);
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toContain("didn’t match");
    expect(authErrorMessage({ code: "auth/popup-blocked" })).toContain("Allow pop-ups");
  });
});

describe("account forms", () => {
  it("validates before contacting Firebase and exposes field errors", async () => {
    render(<AuthForm mode="register" />);
    fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(authMocks.registerCustomer).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
  });
  it("redirects only after the server session has been established", async () => {
    let complete: (() => void) | undefined;
    authMocks.signInCustomer.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    render(<AuthForm mode="sign-in" returnTo="/checkout" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ian@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Welcome back" }));
    await waitFor(() =>
      expect(authMocks.signInCustomer).toHaveBeenCalledWith("ian@example.test", "correct-horse"),
    );
    expect(authMocks.replace).not.toHaveBeenCalled();
    complete?.();
    await waitFor(() => expect(authMocks.replace).toHaveBeenCalledWith("/checkout"));
  });
  it("reports unsuccessful sign-in without redirecting", async () => {
    authMocks.signInCustomer.mockRejectedValueOnce({ code: "auth/invalid-credential" });
    render(<AuthForm mode="sign-in" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ian@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Welcome back" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("didn’t match"));
    expect(authMocks.replace).not.toHaveBeenCalled();
  });
  it("uses an account-neutral password-reset confirmation", async () => {
    authMocks.requestPasswordReset.mockResolvedValueOnce(undefined);
    render(<ResetPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "unknown@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("If an account exists"),
    );
  });
});
