// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { GhostCharacter } from "@/components/ghost/GhostCharacter";
import { GhostArt } from "@/components/ghost/ghost-art";
import type { GhostVisualState } from "@/features/hauntings/model";

beforeAll(() => {
  // jsdom has no matchMedia; Motion's reduced-motion hook reads it.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }),
  });
});

const STATES: GhostVisualState[] = ["idle", "awakening", "observing", "confrontation", "rescheduled", "released", "completed"];

describe("GhostCharacter", () => {
  it.each(STATES)("renders the %s state as an explicit visual state", (state) => {
    const { container } = render(<GhostCharacter state={state} />);
    expect(container.querySelector(`[data-ghost-state="${state}"]`)).not.toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is hidden from assistive technology unless a label is provided", () => {
    const { container } = render(<GhostCharacter state="idle" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    render(<GhostCharacter state="idle" label="A ghost named Passport" />);
    expect(screen.getByRole("img", { name: "A ghost named Passport" })).toBeTruthy();
  });

  it("emits no particle effects in reduced-motion mode", () => {
    const motion = render(<GhostCharacter state="released" />);
    expect(motion.container.querySelectorAll("span.rounded-full").length).toBeGreaterThan(0);
    const reduced = render(<GhostCharacter state="released" reducedMotion />);
    expect(reduced.container.querySelectorAll("span.rounded-full")).toHaveLength(0);
  });

  it("falls back to the static artwork if the animated layer throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // a state whose config lookup fails simulates a broken animation layer
    const { container } = render(<GhostCharacter state={"bogus" as GhostVisualState} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("[data-ghost-state]")).toBeNull();
    vi.restoreAllMocks();
  });

  it("static art alone is a complete, dependency-free SVG", () => {
    const { container } = render(<GhostArt size={80} />);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("80");
    expect(container.querySelectorAll("path").length).toBeGreaterThan(1);
  });
});
