"use client";
import { Component, type ReactNode } from "react";
import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";
import type { GhostVisualState } from "@/features/hauntings/model";
import { GhostArt } from "./ghost-art";

/**
 * Single source of ghost animation (Design §7: "do not build unrelated animation logic in multiple
 * components"). Visual state is a pure input; the character never decides application state.
 *
 * Rive: not used. No licensed/authored .riv asset exists and an inline SVG meets the art direction;
 * the `state` contract below is the seam if a Rive artboard is added later.
 */

const PARTICLES = [
  { x: -34, y: -40 }, { x: 30, y: -52 }, { x: -12, y: -66 }, { x: 44, y: -22 }, { x: -46, y: -10 }, { x: 8, y: -80 },
];

class GhostBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Animated({ state, size, reduced }: { state: GhostVisualState; size: number; reduced: boolean }) {
  const dur = (s: number) => (reduced ? 0.01 : s);

  // Reduced motion: opacity-only changes, no looping movement, no blur.
  const body: Record<GhostVisualState, { animate: TargetAndTransition; transition: Transition }> = {
    idle: reduced
      ? { animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } }
      : { animate: { opacity: 1, y: [0, -6, 0] }, transition: { y: { duration: 5, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 } } },
    awakening: reduced
      ? { animate: { opacity: 1 }, transition: { duration: 0.25 } }
      : { animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }, transition: { duration: dur(0.75), ease: "easeOut" } },
    observing: { animate: { opacity: 1, rotate: reduced ? 0 : -2, y: 0 }, transition: { duration: dur(0.4) } },
    confrontation: { animate: { opacity: 1, rotate: reduced ? 0 : 3, scale: reduced ? 1 : 1.03 }, transition: { duration: dur(0.35) } },
    rescheduled: { animate: { opacity: 0.35, y: reduced ? 0 : 10, scale: reduced ? 1 : 0.92 }, transition: { duration: dur(0.7) } },
    released: { animate: { opacity: 0, scale: reduced ? 1 : 1.08, y: reduced ? 0 : -8 }, transition: { duration: dur(0.8) } },
    completed: { animate: { opacity: 0, y: reduced ? 0 : -14, scale: reduced ? 1 : 0.9 }, transition: { duration: dur(0.6) } },
  };
  const initial =
    state === "awakening" && !reduced ? { opacity: 0, y: 16, scale: 0.96, filter: "blur(6px)" } : { opacity: state === "awakening" ? 0 : 1 };
  const cfg = body[state];

  return (
    <div className="relative" style={{ width: size, height: size * 1.17 }} data-ghost-state={state}>
      <motion.div initial={initial} animate={cfg.animate} transition={cfg.transition}>
        <GhostArt size={size} eyesShift={state === "observing" ? 2 : state === "confrontation" ? -1 : 0} />
      </motion.div>
      {state === "released" && !reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-spectral"
              initial={{ opacity: 0.9, x: 0, y: 0 }}
              animate={{ opacity: 0, x: p.x, y: p.y }}
              transition={{ duration: 0.9, delay: i * 0.04, ease: "easeOut" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function GhostCharacter({
  state,
  size = 120,
  reducedMotion = false,
  label,
}: {
  state: GhostVisualState;
  size?: number;
  /** In-app preference; the OS `prefers-reduced-motion` setting is honoured as well. */
  reducedMotion?: boolean;
  /** Provide for a meaningful (non-decorative) ghost; omitted => hidden from assistive tech. */
  label?: string;
}) {
  const os = useReducedMotion();
  const reduced = reducedMotion || !!os;
  const staticGhost = <GhostArt size={size} />;
  return (
    <div role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <GhostBoundary fallback={staticGhost}>
        <Animated state={state} size={size} reduced={reduced} />
      </GhostBoundary>
    </div>
  );
}
