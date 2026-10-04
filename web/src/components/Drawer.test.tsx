import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Drawer, DrawerSection } from "@/components/Drawer";
import { renderWithProviders } from "@/test/render";

function ControlledHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open drawer</Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Lakeview Builders Group"
        subtitle={<span>Major Contract Awarded</span>}
        ariaLabel="Signal details"
      >
        <DrawerSection title="Evidence">
          <p>Quote</p>
        </DrawerSection>
      </Drawer>
    </>
  );
}

function UrlHarness() {
  return (
    <Drawer searchKey="detail" title="From the URL" ariaLabel="Signal details">
      <p>Body</p>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("opens from controlled state and closes with the close button and Escape", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<ControlledHarness />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    const dialog = await screen.findByRole("dialog", { name: "Signal details" });
    expect(dialog).toHaveTextContent("Lakeview Builders Group");
    expect(dialog).toHaveStyle({ width: "480px" });
    expect(screen.getByRole("heading", { level: 3, name: "Evidence" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("binds its open state to a search param and removes it on close", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<UrlHarness />, { route: "/?detail=9001" });
    await screen.findByRole("dialog", { name: "Signal details" });
    expect(String((router.state.location.search as { detail?: unknown }).detail)).toBe("9001");

    await user.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.state.location.search).not.toHaveProperty("detail");
  });
});
