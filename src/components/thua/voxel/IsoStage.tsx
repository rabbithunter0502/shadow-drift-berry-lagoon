import { useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";

type Props = {
  label: string;
  className?: string;
  heightClass?: string;
  /** Draw one frame; return true to keep animating. */
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => boolean;
  children?: ReactNode;
};

export function IsoStage({ label, className, heightClass = "h-40", paint }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let start = performance.now();
    let alive = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tick = (now: number) => {
      if (!alive) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const t = (now - start) / 1000;
      const keep = paintRef.current(ctx, canvas.width, canvas.height, t);
      if (!reduce && keep) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      className={clsx(
        "voxel-stage relative overflow-hidden rounded-card border border-line bg-surface",
        heightClass,
        className,
      )}
      role="img"
      aria-label={label}
    >
      <canvas ref={ref} className="block h-full w-full" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface/70 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
