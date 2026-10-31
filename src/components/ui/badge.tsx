import { cn } from "@/lib/utils";

type Tone = "neutral" | "spectral" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "border-border text-fg-2",
  spectral: "border-spectral-soft/60 bg-spectral-surface text-spectral",
  success: "border-[#3b5240] text-success",
  warning: "border-[#5c4f2f] text-warning",
  danger: "border-[#5a2f35] text-danger",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em]", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-hover/60", className)} />;
}

export function StateBlock({
  icon,
  title,
  children,
  action,
  tone = "neutral",
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className={tone === "error" ? "text-danger" : "text-spectral-soft"}>{icon}</div>}
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {children && <p className="max-w-md text-sm text-fg-2">{children}</p>}
      {action}
    </div>
  );
}
