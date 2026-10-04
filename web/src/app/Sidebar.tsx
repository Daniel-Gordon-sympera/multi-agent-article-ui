/**
 * Sidebar — mockup §2.2: 240 px, logo block, search box that opens the ⌘K palette, main nav
 * with Lucide icons (Overview · Jobs · Signals · Data Sources · Settings), footer box with the
 * API readiness dot, the user's name/e-mail, the role tag and a small menu holding sign-out.
 * Below 800 px `TopBar` replaces it (same nav, horizontal).
 */
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Briefcase,
  ChevronDown,
  Database,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "@/app/providers/SessionProvider";
import { Tag } from "@/components/Tag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/jobs", label: "Jobs", icon: Briefcase, exact: false },
  { to: "/signals", label: "Signals", icon: Activity, exact: false },
  { to: "/sources", label: "Data Sources", icon: Database, exact: false },
  { to: "/settings", label: "Settings", icon: Settings2, exact: false },
] as const;

const navLinkClass =
  "flex h-10 items-center gap-2.5 rounded-control px-3 text-[14px] font-medium text-ink-2 no-underline outline-none hover:bg-surface-2 hover:text-ink hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:bg-brand-100 aria-[current=page]:font-semibold aria-[current=page]:text-brand-700";

export function LogoBlock({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-control px-2 py-1 no-underline hover:no-underline"
      aria-label="Sympera Scout home"
    >
      <img
        src="/sympera-logo.png"
        alt="Sympera AI logo"
        width={32}
        height={32}
        className="size-8 rounded-control"
      />
      {!compact ? (
        <span className="flex flex-col leading-[1.15]">
          <span className="text-[16px] font-bold tracking-[-0.01em] text-ink">Sympera AI</span>
          <span className="text-[11px] font-semibold tracking-[0.06em] text-brand-600 uppercase">
            Scout
          </span>
        </span>
      ) : null}
    </Link>
  );
}

export function MainNav({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Main" className={cn("flex flex-col gap-1", className)}>
      {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
        <Link
          key={to}
          to={to}
          className={navLinkClass}
          activeOptions={{ exact, includeSearch: false }}
          preload="intent"
          onClick={onNavigate}
        >
          <Icon size={18} strokeWidth={1.75} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function SearchTrigger({
  onOpen,
  compact = false,
}: {
  onOpen: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search jobs, companies and signals"
        aria-keyshortcuts="Meta+K Control+K"
        className="inline-flex size-9 items-center justify-center rounded-control border border-border bg-surface-2 text-muted hover:text-ink"
      >
        <Search size={16} strokeWidth={2} aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search jobs, companies and signals"
      aria-keyshortcuts="Meta+K Control+K"
      className="relative flex h-9 w-full items-center rounded-control border border-border bg-surface-2 pr-11 pl-8 text-left text-[13px] text-muted outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Search size={15} strokeWidth={2} className="absolute left-[11px] text-muted" aria-hidden />
      Search…
      <kbd className="absolute right-2 rounded-kbd border border-border-strong bg-surface px-[5px] py-px font-sans text-[11px] font-semibold text-muted">
        ⌘K
      </kbd>
    </button>
  );
}

export function UserMenu({
  align = "start",
  children,
}: {
  align?: "start" | "end";
  children: ReactNode;
}) {
  const { user, role, signOut } = useSession();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-[13px] font-semibold text-ink">
            {user?.name ?? user?.email}
          </span>
          <span className="block truncate text-[12px] font-normal text-muted">{user?.email}</span>
          {role ? (
            <span className="mt-1 block text-[11px] font-medium text-muted">role: {role}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate({ to: "/settings/preferences" })}>
          <Settings2 size={14} aria-hidden /> Preferences
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: "/account/password" })}>
          <UserRound size={14} aria-hidden /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate({ to: "/sign-in" }));
          }}
        >
          <LogOut size={14} aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ApiStatusLine({ className }: { className?: string }) {
  const { api, me } = useSession();
  const ready = api?.ready ?? false;
  const version = me?.version.pipeline_api;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[12px] font-semibold text-ink-2",
        className,
      )}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          ready ? "bg-status-done-fg" : "bg-status-fail-fg",
        )}
        aria-hidden
      />
      {ready ? "API ready" : "API not ready"}
      {version ? <span className="font-normal text-muted"> · {version}</span> : null}
    </span>
  );
}

export function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { user, role } = useSession();
  return (
    <aside
      className="flex w-sidebar shrink-0 flex-col gap-5 border-r border-border bg-surface px-4 py-5"
      aria-label="Sidebar"
    >
      <LogoBlock />
      <SearchTrigger onOpen={onOpenSearch} />
      <MainNav />
      <div className="mt-auto flex flex-col gap-2.5 rounded-banner border border-border bg-surface-2 p-3">
        <ApiStatusLine />
        <UserMenu>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-tag text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Account menu"
          >
            <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-muted">
              <span className="truncate">{user?.name || user?.email}</span>
              <ChevronDown size={12} aria-hidden />
            </span>
            {role ? <Tag tone="brand">{role}</Tag> : null}
          </button>
        </UserMenu>
      </div>
    </aside>
  );
}

/** Top bar for narrow viewports (< 800 px, chosen by `AppShell`): logo, nav, search, account menu. */
export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { role } = useSession();
  return (
    <header
      className="flex flex-col gap-2 border-b border-border bg-surface px-3 py-2"
      aria-label="Top bar"
    >
      <div className="flex items-center justify-between gap-2">
        <LogoBlock />
        <div className="flex items-center gap-2">
          <ApiStatusLine className="hidden sm:inline-flex" />
          <SearchTrigger onOpen={onOpenSearch} compact />
          <UserMenu align="end">
            <button
              type="button"
              aria-label="Account menu"
              className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-surface-2 px-2.5 text-[12px] font-semibold text-ink-2"
            >
              <UserRound size={14} aria-hidden />
              {role}
            </button>
          </UserMenu>
        </div>
      </div>
      <MainNav className="flex-row gap-1 overflow-x-auto [&>a]:h-9 [&>a]:shrink-0 [&>a]:text-[13px]" />
    </header>
  );
}
