"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/switch";
import { GhostArt } from "@/components/ghost/ghost-art";
import { api, ApiError } from "@/lib/client/api";

export default function LoginPage() {
  const router = useRouter();
  const [tz, setTz] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
    } catch {
      return ["UTC"];
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/guest", { method: "POST", body: { timezone: tz, seedDemo: seed } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open the archive.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-4">
        <GhostArt size={56} />
        <div>
          <p className="font-mono text-[13px] font-medium tracking-[0.28em]">ABANDONMENT</p>
          <h1 className="text-2xl font-semibold">Open your archive</h1>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-surface p-5" noValidate>
        <p className="text-sm text-fg-2">
          This creates a private guest archive tied to this browser — no email or password. Deadlines and the midnight review follow the time zone below.
        </p>
        <div>
          <Label htmlFor="tz">Your time zone</Label>
          <Input id="tz" list="tz-list" value={tz} onChange={(e) => setTz(e.target.value)} autoComplete="off" spellCheck={false} suppressHydrationWarning />
          <datalist id="tz-list">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="seed" checked={seed} onCheckedChange={(c) => setSeed(c === true)} />
          <div>
            <Label htmlFor="seed" className="!mb-0.5 text-fg">Start with sample case files</Label>
            <p className="text-[13px] text-muted">Adds a few tasks, some already overdue, so you can meet a ghost right away.</p>
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" variant="primary" className="w-full" loading={busy}>
          Enter the archive
        </Button>
      </form>
      <p className="mt-4 text-center text-[13px] text-muted">
        <Link href="/" className="hover:text-fg">← Back</Link>
      </p>
    </main>
  );
}
