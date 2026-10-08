/**
 * AppShell — mockup §2.1: flex frame on the page background; 240 px Sidebar (top bar below
 * 800 px) + main column (`padding: 28px 32px 40px`, vertical gap 20). Hosts the ⌘K palette.
 */
import { useSession } from "@/app/providers/SessionProvider";
import { NoteBanner } from "@/components/NoteBanner";
import { useCallback, useState, type ReactNode } from "react";
import { CommandPalette, useCommandPaletteShortcut } from "@/app/CommandPalette";
import { Sidebar, TopBar } from "@/app/Sidebar";
import { NARROW_LAYOUT_QUERY, useMediaQuery } from "@/lib/hooks/useMediaQuery";

export function AppShell({ children }: { children: ReactNode }) {
  const { contract } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toggle = useCallback(() => setPaletteOpen((open) => !open), []);
  useCommandPaletteShortcut(toggle);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const narrow = useMediaQuery(NARROW_LAYOUT_QUERY);

  return (
    <div className="flex min-h-screen flex-col bg-page min-[800px]:flex-row">
      <a
        href="#main-content"
        className="sr-only-focusable fixed top-2 left-2 z-[60] rounded-control bg-surface px-3 py-2 text-[13px] font-semibold text-ink shadow-popover"
      >
        Skip to content
      </a>
      {narrow ? <TopBar onOpenSearch={openPalette} /> : <Sidebar onOpenSearch={openPalette} />}
      <main
        id="main-content"
        className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 pb-10 min-[800px]:px-8 min-[800px]:pt-7"
        tabIndex={-1}
      >
        {contract?.compatible === false ? (
          <NoteBanner tone="warn">
            The pipeline API is not compatible with this console.{" "}
            {contract.contract_errors?.join(" ")}
          </NoteBanner>
        ) : null}
        {children}
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
