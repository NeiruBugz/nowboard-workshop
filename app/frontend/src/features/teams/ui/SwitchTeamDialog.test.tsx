import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SwitchTeamDialog } from "./SwitchTeamDialog";

function setup(overrides: Partial<Parameters<typeof SwitchTeamDialog>[0]> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  const props = {
    open: true,
    currentTeam: { name: "Beta" },
    newTeam: { name: "Alpha" },
    onCancel,
    onConfirm,
    isConfirming: false,
    ...overrides,
  };
  render(<SwitchTeamDialog {...props} />);
  return { onCancel, onConfirm };
}

describe("SwitchTeamDialog", () => {
  it("renders title with current team name", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: /leave beta\?/i }),
    ).toBeInTheDocument();
  });

  it("primary button reads 'Join <newTeam>'", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Join Alpha" }),
    ).toBeInTheDocument();
  });

  it("Cancel button invokes onCancel", async () => {
    const { onCancel, onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Confirm button invokes onConfirm", async () => {
    const { onCancel, onConfirm } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Join Alpha" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("disables both action buttons while confirming", () => {
    setup({ isConfirming: true });
    expect(screen.getByRole("button", { name: "Join Alpha" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
