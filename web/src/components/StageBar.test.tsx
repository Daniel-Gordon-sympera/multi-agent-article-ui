import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageBar } from "@/components/StageBar";
import { TooltipProvider } from "@/components/ui/tooltip";

function renderBar(props: Parameters<typeof StageBar>[0]) {
  return render(
    <TooltipProvider>
      <StageBar {...props} />
    </TooltipProvider>,
  );
}

describe("StageBar", () => {
  it("renders five segments describing the stage progress", () => {
    renderBar({ status: "analysing", tooltips: false });
    const bar = screen.getByRole("img", { name: /Stage progress/ });
    expect(bar.querySelectorAll("[data-stage]")).toHaveLength(5);
    expect(bar).toHaveAttribute("data-states", "done done done current pending");
    expect(bar.getAttribute("aria-label")).toContain("Analysing in progress");
    expect(bar).toHaveStyle({ width: "84px" });
  });

  it("colours the failing stage and honours the width", () => {
    renderBar({ status: "failed", stopReason: "no_sources_found", width: 140, tooltips: false });
    const bar = screen.getByRole("img", { name: /Stage progress/ });
    expect(bar).toHaveAttribute("data-states", "failed pending pending pending pending");
    expect(bar.querySelector('[data-stage="finding"]')).toHaveClass("bg-status-fail-fg");
    expect(bar).toHaveStyle({ width: "140px" });
  });

  it("accepts explicit states", () => {
    renderBar({ states: ["done", "done", "done", "done", "done"], tooltips: false });
    expect(screen.getByRole("img")).toHaveAttribute("data-states", "done done done done done");
  });
});
