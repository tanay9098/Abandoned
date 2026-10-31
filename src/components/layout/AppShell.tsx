"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Ghost, ListTodo, LogOut, Moon, Settings, Sun, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton, StateBlock } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { stamp } from "@/lib/client/format";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Today", icon: Sun },
  { href: "/tasks", label: "Upcoming", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/graveyard", label: "Graveyard", icon: Ghost },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ orientation }: { orientation: "side" | "bottom" }) {
  const path = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== "/dashboard" && path.startsWith(href + "/")) || (href === "/tasks" && path.startsWith("/tasks"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md text-sm font-medium transition-colors duration-150",
              orientation === "side" ? "px-3 py-2.5" : "min-h-14 flex-1 flex-col justify-center gap-1 px-1 text-[11px]",
              active ? "bg-spectral-surface text-spectral" : "text-fg-2 hover:bg-hover hover:text-fg",
              orientation === "side" && active && "shadow-[inset_2px_0_0_var(--spectral)]",
              href === "/settings" && orientation === "side" && "mt-auto",
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function HeaderControls() {
  const ws = useWorkspace();
  const on = !!ws.prefs?.soundEnabled;
  return (
    <div className="flex items-center gap-1">
      {ws.review?.review && (
        <Button variant="ghost" size="sm" onClick={() => ws.openReview(false)} aria-label="Open the latest midnight review">
          <Moon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Midnight review</span>
          {ws.review.pending && <span className="h-2 w-2 rounded-full bg-spectral" aria-label="unread" />}
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-pressed={on} aria-label={on ? "Sound on. Turn sound off" : "Sound off. Turn sound on"} onClick={() => void ws.updatePrefs({ soundEnabled: !on }).catch(() => undefined)}>
        {on ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const ws = useWorkspace();
  const router = useRouter();
  const [confirmOut, setConfirmOut] = useState(false);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-border bg-surface px-3 py-5 lg:flex" aria-label="Primary">
        <Link href="/dashboard" className="mb-5 px-3 font-mono text-[13px] font-medium tracking-[0.28em] text-fg">
          ABANDONMENT
        </Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          <NavLinks orientation="side" />
        </nav>
        <button onClick={() => setConfirmOut(true)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted hover:bg-hover hover:text-fg">
          <LogOut className="h-[18px] w-[18px]" aria-hidden /> Sign out
        </button>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-mono text-[12px] font-medium tracking-[0.24em] lg:hidden">
              ABANDONMENT
            </Link>
            <span className="meta hidden sm:inline" data-testid="clock">{stamp(ws.nowMs, ws.tz)} · {ws.tz}</span>
          </div>
          <HeaderControls />
        </header>
        <main className="px-4 py-6 sm:px-6 lg:py-8">
          {ws.loadError ? (
            <StateBlock tone="error" title="The archive would not open." action={<Button onClick={() => window.location.reload()}>Try again</Button>}>
              {ws.loadError}
            </StateBlock>
          ) : !ws.ready ? (
            <div className="space-y-3" role="status" aria-label="Loading your archive">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface px-1 lg:hidden" aria-label="Main">
        <NavLinks orientation="bottom" />
      </nav>

      <Dialog open={confirmOut} onOpenChange={setConfirmOut}>
        <DialogContent>
          <DialogTitle>Sign out of this archive?</DialogTitle>
          <DialogDescription>
            Your archive is a guest archive tied to this browser. Signing out removes the session cookie, and this archive cannot be reopened afterwards.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOut(false)} autoFocus>
              Stay
            </Button>
            <Button variant="danger" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Page frame: heading + optional contextual right panel (Design §5). */
export function Workspace({ eyebrow, title, actions, aside, children }: { eyebrow?: string; title: string; actions?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn("mx-auto grid max-w-[1180px] gap-8", aside && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow && <p className="meta mb-1">{eyebrow}</p>}
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
          </div>
          {actions}
        </div>
        {children}
      </div>
      {aside && <aside className="hidden xl:block" aria-label="Haunting panel"><div className="sticky top-20">{aside}</div></aside>}
    </div>
  );
}
