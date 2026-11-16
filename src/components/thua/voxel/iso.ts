/** Tiny isometric voxel helpers — no Three.js, mobile-friendly. */

export const PALETTE = {
  bg: "#14120e",
  floor: "#2c271f",
  grid: "#3a342b",
  wood: "#6b4a2e",
  woodDark: "#4a3220",
  accent: "#d4724b",
  mint: "#7d9a7a",
  cloth: "#8b6b4a",
  bag: "#c47a4a",
  coin: "#e0b15a",
  muted: "#a39888",
  fg: "#f3ecdf",
  door: "#5c4030",
} as const;

export type Vox = { x: number; y: number; z: number; color: string; size?: number };

/** Project voxel grid → canvas 2D isometric. */
export function project(x: number, y: number, z: number, ox: number, oy: number, s: number) {
  return {
    px: ox + (x - z) * s,
    py: oy + (x + z) * (s * 0.5) - y * s,
  };
}

export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  ox: number,
  oy: number,
  s: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const top = shade(color, 1.18);
  const left = shade(color, 0.72);
  const right = shade(color, 0.9);

  const p = (vx: number, vy: number, vz: number) => project(vx, vy, vz, ox, oy, s);

  const a = p(x, y + h, z);
  const b = p(x + w, y + h, z);
  const c = p(x + w, y + h, z + d);
  const d0 = p(x, y + h, z + d);

  // top
  ctx.beginPath();
  ctx.moveTo(a.px, a.py);
  ctx.lineTo(b.px, b.py);
  ctx.lineTo(c.px, c.py);
  ctx.lineTo(d0.px, d0.py);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();

  // left
  const e = p(x, y, z + d);
  const f = p(x, y, z);
  ctx.beginPath();
  ctx.moveTo(d0.px, d0.py);
  ctx.lineTo(c.px, c.py);
  ctx.lineTo(p(x + w, y, z + d).px, p(x + w, y, z + d).py);
  ctx.lineTo(e.px, e.py);
  ctx.closePath();
  // actually left face is x-fixed: a,d0,e,f
  ctx.beginPath();
  ctx.moveTo(a.px, a.py);
  ctx.lineTo(d0.px, d0.py);
  ctx.lineTo(e.px, e.py);
  ctx.lineTo(f.px, f.py);
  ctx.closePath();
  ctx.fillStyle = left;
  ctx.fill();

  // right
  const g = p(x + w, y, z);
  const h0 = p(x + w, y, z + d);
  ctx.beginPath();
  ctx.moveTo(b.px, b.py);
  ctx.lineTo(c.px, c.py);
  ctx.lineTo(h0.px, h0.py);
  ctx.lineTo(g.px, g.py);
  ctx.closePath();
  ctx.fillStyle = right;
  ctx.fill();

  ctx.restore();
}

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);
}

export function drawFloor(ctx: CanvasRenderingContext2D, ox: number, oy: number, s: number, n = 6) {
  for (let x = 0; x < n; x++) {
    for (let z = 0; z < n; z++) {
      drawBox(ctx, x, 0, z, 1, 0.12, 1, (x + z) % 2 === 0 ? PALETTE.floor : PALETTE.grid, ox, oy, s);
    }
  }
}

/** Painter's algorithm: sort by x+z then y. */
export function sortVoxels<T extends { x: number; y: number; z: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.x + a.z - (b.x + b.z) || a.y - b.y);
}
