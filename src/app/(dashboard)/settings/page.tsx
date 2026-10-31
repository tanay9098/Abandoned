"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Workspace } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Slider, Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { isValidTimeZone } from "@/lib/datetime/zone";

function Row({ id, title, children, control }: { id: string; title: string; children?: React.ReactNode; control: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="!mb-0.5 text-[15px] font-semibold text-fg">{title}</Label>
        {children && <p className="max-w-prose text-[13.5px] text-fg-2">{children}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

export default function SettingsPage() {
  const ws = useWorkspace();
  const p = ws.prefs;
  const [tz, setTz] = useState(p?.timezone ?? "");
  const [tzError, setTzError] = useState<string | null>(null);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);
  if (!p) return null;
  const save = (patch: Parameters<typeof ws.updatePrefs>[0]) => void ws.updatePrefs(patch).catch(() => undefined);

  return (
    <Workspace eyebrow="PREFERENCES" title="Settings">
      <div className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
        <section aria-labelledby="s-time" className="py-2">
          <h2 id="s-time" className="meta pt-3">Time</h2>
          <div className="py-4">
            <Label htmlFor="tz">Time zone</Label>
            <div className="flex gap-2">
              <Input id="tz" list="tzs" value={tz} onChange={(e) => { setTz(e.target.value); setTzError(null); }} spellCheck={false} aria-invalid={!!tzError} />
              <datalist id="tzs">{zones.map((z) => <option key={z} value={z} />)}</datalist>
              <Button onClick={() => (isValidTimeZone(tz) ? save({ timezone: tz }) : setTzError("Choose a valid IANA time zone, e.g. Asia/Kolkata."))} disabled={tz === p.timezone}>Save</Button>
            </div>
            {tzError && <p role="alert" className="mt-1.5 text-[13px] text-danger">{tzError}</p>}
            <p className="mt-1.5 text-[13px] text-muted">The midnight review follows this zone. Changing it never rewrites past deadlines or history.</p>
          </div>
        </section>

        <section aria-labelledby="s-sound" className="py-2">
          <h2 id="s-sound" className="meta pt-3">Sound</h2>
          <Row id="snd" title="Sound effects" control={<Switch id="snd" checked={p.soundEnabled} onCheckedChange={(v) => save({ soundEnabled: v })} />}>
            Whoosh, chimes and soft tones for hauntings. Off by default. The app never needs sound to be understood.
          </Row>
          <Row id="amb" title="Ambient wind" control={<Switch id="amb" checked={p.ambientEnabled} disabled={!p.soundEnabled} onCheckedChange={(v) => save({ ambientEnabled: v })} />}>
            A quiet loop while the app is open and visible. Pauses in quiet hours.
          </Row>
          <div className="py-4">
            <Label htmlFor="vol">Volume · {Math.round(p.soundVolume * 100)}%</Label>
            <Slider id="vol" aria-label="Volume" min={0} max={100} step={5} value={[Math.round(p.soundVolume * 100)]} disabled={!p.soundEnabled} onValueCommit={([v]) => save({ soundVolume: (v ?? 0) / 100 })} onValueChange={([v]) => void v} />
          </div>
          <div className="py-4">
            <p className="text-[15px] font-semibold">Quiet hours</p>
            <p className="mb-2 text-[13.5px] text-fg-2">Automatic sounds (a ghost arriving, the midnight chimes) stay silent in this window. Sounds you trigger yourself still play.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div><Label htmlFor="qs">From</Label><Input id="qs" type="time" className="w-[130px]" value={p.quietHoursStart ?? ""} onChange={(e) => e.target.value && save({ quietHoursStart: e.target.value, quietHoursEnd: p.quietHoursEnd ?? "07:00" })} /></div>
              <div><Label htmlFor="qe">Until</Label><Input id="qe" type="time" className="w-[130px]" value={p.quietHoursEnd ?? ""} onChange={(e) => e.target.value && save({ quietHoursEnd: e.target.value, quietHoursStart: p.quietHoursStart ?? "22:00" })} /></div>
              {(p.quietHoursStart || p.quietHoursEnd) && <Button variant="ghost" onClick={() => save({ quietHoursStart: null, quietHoursEnd: null })}>Clear</Button>}
            </div>
          </div>
        </section>

        <section aria-labelledby="s-motion" className="py-2">
          <h2 id="s-motion" className="meta pt-3">Motion & midnight</h2>
          <Row id="rm" title="Reduce motion" control={<Switch id="rm" checked={p.reducedMotion} onCheckedChange={(v) => save({ reducedMotion: v })} />}>
            Replaces movement with simple fades. Independent of sound. Your system’s reduced-motion setting is always respected too.
          </Row>
          <div className="py-4">
            <Label htmlFor="mp">Midnight review</Label>
            <Select id="mp" value={p.midnightPresentation} onChange={(e) => save({ midnightPresentation: e.target.value as typeof p.midnightPresentation })} className="max-w-xs">
              <option value="ritual">Open the full review when I arrive</option>
              <option value="banner">Show a quiet banner instead</option>
              <option value="off">Don’t present it automatically</option>
            </Select>
            <p className="mt-1.5 text-[13px] text-muted">It can always be skipped, and reopened from the Graveyard.</p>
          </div>
        </section>

        <section aria-labelledby="s-ai" className="py-2">
          <h2 id="s-ai" className="meta pt-3">Ghost dialogue</h2>
          <Row id="ai" title="AI-written dialogue" control={<Switch id="ai" checked={p.aiDialogueEnabled} onCheckedChange={(v) => save({ aiDialogueEnabled: v })} />}>
            Off by default. If you turn it on (and the server has a model configured), the ghost’s lines are written by an open-weight Gemma model. Only the task title and how long it has been overdue are sent to it — never descriptions or Calendar content. Without it, the ghost uses built-in lines.
          </Row>
        </section>

        <section aria-labelledby="s-int" className="py-2">
          <h2 id="s-int" className="meta pt-3">Integrations</h2>
          <div className="py-4">
            <p className="text-sm text-fg-2">Google Calendar is {ws.connection?.connected ? (ws.connection.isDemo ? "connected (demo calendar)" : "connected (read-only)") : "not connected"}.</p>
            <Button asChild className="mt-2"><Link href="/calendar">Manage calendar</Link></Button>
          </div>
        </section>
      </div>
    </Workspace>
  );
}
