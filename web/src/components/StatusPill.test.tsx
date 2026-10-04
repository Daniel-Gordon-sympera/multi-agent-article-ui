import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "@/components/StatusPill";
import { MaterialityPill } from "@/components/MaterialityPill";

describe("StatusPill", () => {
  it("renders the job status wording with its tone", () => {
    render(<StatusPill entity="job" status="analysing" />);
    const pill = screen.getByText("Analysing");
    expect(pill).toHaveAttribute("data-tone", "running");
    expect(pill.querySelector("span")).not.toBeNull();
  });

  it("uses a triangle icon instead of a dot for failed jobs", () => {
    render(<StatusPill entity="job" status="failed" />);
    const pill = screen.getByText("Failed");
    expect(pill).toHaveAttribute("data-tone", "fail");
    expect(pill.querySelector("svg")).not.toBeNull();
  });

  it("renders the secondary stop reason line", () => {
    render(<StatusPill entity="job" status="partial" secondary="site_time_limit" />);
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.getByText("site_time_limit")).toHaveClass("font-mono");
  });

  it("maps task and worker entities from their rows", () => {
    render(
      <>
        <StatusPill
          entity="task"
          task={{ status: "dead", run_after: "2026-10-04T11:00:00Z", result: null }}
        />
        <StatusPill
          entity="worker"
          worker={{ last_seen: new Date().toISOString(), gone_at: null }}
        />
        <StatusPill entity="source" status="active" size="sm" />
      </>,
    );
    expect(screen.getByText("Dead")).toHaveAttribute("data-tone", "fail");
    expect(screen.getByText("Healthy")).toHaveAttribute("data-tone", "done");
    expect(screen.getByText("Active")).toHaveClass("h-[22px]");
  });
});

describe("MaterialityPill", () => {
  it("renders the three levels and a dash for unknown values", () => {
    render(
      <>
        <MaterialityPill materiality="High" />
        <MaterialityPill materiality="medium" />
        <MaterialityPill materiality="Low" />
        <MaterialityPill materiality={null} />
      </>,
    );
    expect(screen.getByText("High")).toHaveAttribute("data-materiality", "high");
    expect(screen.getByText("Medium")).toHaveAttribute("data-materiality", "medium");
    expect(screen.getByText("Low")).toHaveAttribute("data-materiality", "low");
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
