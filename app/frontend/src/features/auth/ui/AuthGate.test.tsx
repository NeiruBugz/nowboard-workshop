import { describe, it, expect } from "vitest";
import { resolveDestination, type GateState } from "./AuthGate";

const LOGGED_OUT: GateState = {
  hasUser: false,
  needsDisplayName: false,
  hasTeam: false,
};
const NEEDS_NAME: GateState = {
  hasUser: true,
  needsDisplayName: true,
  hasTeam: false,
};
const NAMED_NO_TEAM: GateState = {
  hasUser: true,
  needsDisplayName: false,
  hasTeam: false,
};
const FULLY_ONBOARDED: GateState = {
  hasUser: true,
  needsDisplayName: false,
  hasTeam: true,
};

const PATHS = ["/", "/onboarding", "/board", "/join/abc"] as const;

describe("resolveDestination", () => {
  describe("logged out", () => {
    it.each(PATHS)("path %s", (path) => {
      const got = resolveDestination(LOGGED_OUT, path);
      const expected =
        path === "/" || path.startsWith("/join/") ? null : "/";
      expect(got).toBe(expected);
    });
  });

  describe("authed, needs display name", () => {
    it.each(PATHS)("path %s", (path) => {
      const got = resolveDestination(NEEDS_NAME, path);
      expect(got).toBe(path === "/onboarding" ? null : "/onboarding");
    });
  });

  describe("authed, named, no team", () => {
    it.each(PATHS)("path %s", (path) => {
      const got = resolveDestination(NAMED_NO_TEAM, path);
      if (path === "/onboarding" || path.startsWith("/join/")) {
        expect(got).toBeNull();
      } else {
        expect(got).toBe("/onboarding");
      }
    });
  });

  describe("fully onboarded", () => {
    it.each(PATHS)("path %s", (path) => {
      const got = resolveDestination(FULLY_ONBOARDED, path);
      if (path === "/" || path === "/onboarding") {
        expect(got).toBe("/board");
      } else {
        expect(got).toBeNull();
      }
    });
  });
});
