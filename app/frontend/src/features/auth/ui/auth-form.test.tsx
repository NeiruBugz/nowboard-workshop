import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/shared/api/generated", () => ({
  signInApiAuthSignInPost: vi.fn(),
  signUpApiAuthSignUpPost: vi.fn(),
  joinTeamApiTeamsJoinPost: vi.fn(),
}));

import {
  signInApiAuthSignInPost,
  signUpApiAuthSignUpPost,
} from "@/shared/api/generated";
import { AuthForm } from "./auth-form";
import { currentUserQueryKey } from "@/shared/model/use-current-user";

const signInMock = vi.mocked(signInApiAuthSignInPost);
const signUpMock = vi.mocked(signUpApiAuthSignUpPost);

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  const utils = render(
    <QueryClientProvider client={client}>
      <AuthForm />
    </QueryClientProvider>,
  );
  return { ...utils, client, invalidateSpy };
}

async function fillCredentials(email = "a@b.com", password = "password123") {
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.type(screen.getByLabelText(/password/i), password);
}

function apiError(status: number, body: Record<string, unknown> = {}) {
  return new Error(JSON.stringify({ status, body }));
}

describe("AuthForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  it("submits sign-in and invalidates the current-user query on success", async () => {
    signInMock.mockResolvedValueOnce({} as never);
    const { invalidateSpy } = renderWithClient();

    await fillCredentials();
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        body: { email: "a@b.com", password: "password123" },
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: currentUserQueryKey,
      });
    });
  });

  it("renders 'Email or password is incorrect' on 401", async () => {
    signInMock.mockRejectedValueOnce(apiError(401));
    renderWithClient();

    await fillCredentials();
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText(/email or password is incorrect/i),
    ).toBeInTheDocument();
  });

  it("renders email-taken message on 409 during sign-up", async () => {
    signUpMock.mockRejectedValueOnce(apiError(409, { error: "email_taken" }));
    renderWithClient();

    await userEvent.click(screen.getByRole("tab", { name: /sign up/i }));
    await fillCredentials();
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    expect(
      await screen.findByText(/an account with this email already exists/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch to sign in/i }),
    ).toBeInTheDocument();
  });
});
