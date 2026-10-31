"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check, CalendarClock, Feather } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GhostCharacter } from "@/components/ghost/GhostCharacter";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { MIDNIGHT_SUBLINE, midnightHeadline, waitingLine } from "@/features/hauntings/dialogue";

function MidnightMark() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden focusable="false">
      <circle cx="32" cy="32" r="29" fill="none" stroke="#30333f" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const major = i % 3 === 0;
        return <line key={i} x1={32 + Math.sin(a) * (major ? 22 : 25)} y1={32 - Math.cos(a) * (major ? 22 : 25)} x2={32 + Math.sin(a) * 28} y2={32 - Math.cos(a) * 28} stroke={major ? "#b9a5ff" : "#545868"} strokeWidth={major ? 2 : 1} />;
      })}
      <line x1="32" y1="32" x2="32" y2="12" stroke="#e8e5df" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="32" x2="32" y2="18" stroke="#b9a5ff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.5" fill="#e8e5df" />
    </svg>
  );
}

/**
 * The signature moment (Design §10). Skippable at any time (button or Esc); the task list stays
 * reachable; every line of content is in the DOM immediately, so the staggered reveal is purely visual.
 */
export function MidnightReview() {
  const ws = useWorkspace();
  const os = useReducedMotion();
  const reduced = !!os || !!ws.prefs?.reducedMotion;
  const r = ws.review?.review;
  if (!r) return null;

  const live = new Map((ws.review?.tasks ?? []).map((t) => [t.id, t]));
  const items = r.summary.tasks.filter((t) => live.get(t.id)?.status === "pending");
  const resolved = r.summary.tasks.length - items.length;
  const events = r.summary.counts.eventsAwaitingReview;
  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.01 : 0.5, delay: reduced ? 0 : delay },
  });

  return (
    <Dialog open={ws.reviewOpen} onOpenChange={(o) => !o && void ws.closeReview(true)}>
      <DialogContent hideClose overlayClassName="bg-[#05060a]/90" className="max-w-xl border-spectral-soft/30 bg-background" data-testid="midnight-review">
        <motion.div {...reveal(0)} className="flex flex-col items-center gap-3 text-center">
          <MidnightMark />
          <p className="meta">MIDNIGHT REVIEW · {r.localDate}</p>
        </motion.div>

        <motion.div {...reveal(0.6)} className="mt-4 text-center">
          <DialogTitle className="pr-0 font-serif text-[26px] font-medium leading-snug">{midnightHeadline(r.summary.counts.overdueTasks)}</DialogTitle>
          <DialogDescription className="ghost-voice mt-2 text-fg-2">{MIDNIGHT_SUBLINE}</DialogDescription>
        </motion.div>

        {items.length > 0 && (
          <motion.div {...reveal(1.1)} className="mt-5 flex justify-center gap-3" aria-hidden>
            {items.slice(0, 3).map((t) => (
              <GhostCharacter key={t.id} state="idle" size={52} reducedMotion={reduced} />
            ))}
          </motion.div>
        )}

        <motion.div {...reveal(1.6)} className="mt-6">
          {items.length > 0 ? (
            <>
              <p className="ghost-voice mb-3 text-center text-[16px]">Do you still want to carry these forward?</p>
              <ul className="space-y-2" data-testid="review-items">
                {items.slice(0, 6).map((t) => {
                  const task = ws.tasks.find((x) => x.id === t.id);
                  const days = Math.floor(t.overdueMs / 86_400_000);
                  return (
                    <li key={t.id} className="rounded-lg border border-border bg-surface p-3">
                      <p className="font-semibold leading-snug">{t.title}</p>
                      <p className="meta mt-0.5">{waitingLine(days)}</p>
                      {task && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <Button size="sm" variant="primary" onClick={() => void ws.completeTask(task)} aria-label={`Complete ${t.title}`}>
                            <Check className="h-4 w-4" aria-hidden /> Complete
                          </Button>
                          <Button size="sm" onClick={() => ws.openDialog({ type: "reschedule", task })} aria-label={`Reschedule ${t.title}`}>
                            <CalendarClock className="h-4 w-4" aria-hidden /> Reschedule
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => ws.openDialog({ type: "release", task })} aria-label={`Release ${t.title}`}>
                            <Feather className="h-4 w-4" aria-hidden /> Release
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {r.summary.tasks.length > 6 && <p className="meta mt-2 text-center">+ {r.summary.tasks.length - 6} more in your task list</p>}
            </>
          ) : (
            <p className="text-center text-sm text-fg-2">{resolved > 0 ? "Everything from this review has been resolved. Rest well." : "Nothing is waiting for you."}</p>
          )}
          {events > 0 && (
            <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-center text-sm text-fg-2">
              {events} calendar event{events > 1 ? "s have" : " has"} ended. Only you can say whether you were there —{" "}
              <Link href="/calendar" className="text-spectral underline" onClick={() => void ws.closeReview(true)}>
                review {events > 1 ? "them" : "it"}
              </Link>
              .
            </p>
          )}
        </motion.div>

        <motion.div {...reveal(2.0)} className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={() => void ws.closeReview(true)} autoFocus>
            Open my task list
          </Button>
          <Button variant="ghost" onClick={() => void ws.closeReview(true)}>
            Skip
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
