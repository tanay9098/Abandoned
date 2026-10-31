import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/server/auth/session";
import { GhostArt } from "@/components/ghost/ghost-art";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STEPS = [
  ["01", "A deadline passes", "The task is still unfinished. A server-side check records it exactly once — no AI, no guesswork."],
  ["02", "A ghost wakes", "It shows how long it has waited and asks, gently, what you want to do."],
  ["03", "You decide", "Complete it, reschedule it, or release it on purpose. Nothing is lost, nothing is shamed."],
];

export default async function Landing() {
  if (verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/dashboard");
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-8 sm:px-8">
      <header className="flex items-center justify-between">
        <span className="font-mono text-[13px] font-medium tracking-[0.28em]">ABANDONMENT</span>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Enter the archive</Link>
        </Button>
      </header>

      <main className="grid flex-1 items-center gap-10 py-14 md:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="meta mb-3">A TO-DO LIST WITH A MEMORY</p>
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight sm:text-5xl">Your unfinished business has come back to haunt you.</h1>
          <p className="mt-5 max-w-[52ch] text-[17px] text-fg-2">
            Abandonment is a real task manager with deadlines, Google Calendar and a midnight review. When a commitment slips past its time, it
            doesn’t turn red — it gets a ghost. You can finish it, move it, or let it go.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="md">
              <Link href="/login">Open the archive</Link>
            </Button>
          </div>
          <p className="meta mt-4">Works with sound off and motion reduced. No account required for the demo.</p>
        </div>
        <div className="flex justify-center" aria-hidden>
          <div className="rounded-2xl border border-border bg-surface p-10">
            <GhostArt size={170} />
          </div>
        </div>
      </main>

      <section aria-label="How it works" className="grid gap-4 border-t border-border py-10 sm:grid-cols-3">
        {STEPS.map(([n, t, d]) => (
          <div key={n}>
            <p className="meta">{n}</p>
            <h2 className="mt-1 text-[16px] font-semibold">{t}</h2>
            <p className="mt-1.5 text-sm text-fg-2">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
