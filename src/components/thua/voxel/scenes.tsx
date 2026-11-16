import { useMemo } from "react";
import { IsoStage } from "./IsoStage";
import { PALETTE, clear, drawBox, drawFloor, sortVoxels } from "./iso";

type Block = { x: number; y: number; z: number; w: number; h: number; d: number; color: string; alpha?: number };

function paintBlocks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  blocks: Block[],
  opts?: { ox?: number; oy?: number; s?: number; bob?: boolean },
) {
  clear(ctx, width, height);
  const s = opts?.s ?? Math.min(width, height) * 0.085;
  const ox = opts?.ox ?? width * 0.5 - s * 0.5;
  const oy = opts?.oy ?? height * 0.62;
  drawFloor(ctx, ox, oy, s, 6);

  const bob = opts?.bob === false ? 0 : Math.sin(t * 1.4) * 0.08;
  const drawn = sortVoxels(
    blocks.map((b, i) => ({
      ...b,
      y: b.y + (b.alpha === undefined || b.alpha > 0.2 ? bob * (0.4 + (i % 3) * 0.15) : 0),
    })),
  );
  for (const b of drawn) {
    drawBox(ctx, b.x, b.y, b.z, b.w, b.h, b.d, b.color, ox, oy, s, b.alpha ?? 1);
  }
  return true;
}

const CLUTTER: Block[] = [
  { x: 1.35, y: 0.55, z: 2.15, w: 0.65, h: 0.55, d: 0.55, color: PALETTE.cloth },
  { x: 2.15, y: 0.55, z: 2.1, w: 0.4, h: 0.8, d: 0.3, color: PALETTE.accent },
  { x: 2.85, y: 0.55, z: 2.2, w: 0.7, h: 0.5, d: 0.5, color: PALETTE.bag },
  { x: 3.65, y: 0.55, z: 2.15, w: 0.45, h: 0.45, d: 0.45, color: PALETTE.mint },
  { x: 1.45, y: 1.55, z: 2.1, w: 0.55, h: 0.4, d: 0.5, color: PALETTE.mint },
  { x: 2.2, y: 1.55, z: 2.15, w: 0.7, h: 0.55, d: 0.5, color: PALETTE.cloth },
  { x: 3.1, y: 1.55, z: 2.05, w: 0.35, h: 0.75, d: 0.28, color: PALETTE.accent },
  { x: 3.6, y: 1.55, z: 2.2, w: 0.55, h: 0.45, d: 0.45, color: PALETTE.bag },
];

function shelfFrame(): Block[] {
  return [
    { x: 1.1, y: 0.2, z: 1.9, w: 3.3, h: 0.22, d: 1.05, color: PALETTE.woodDark },
    { x: 1.1, y: 1.2, z: 1.9, w: 3.3, h: 0.22, d: 1.05, color: PALETTE.wood },
    { x: 1.1, y: 2.15, z: 1.9, w: 3.3, h: 0.18, d: 1.05, color: PALETTE.wood },
    { x: 1.1, y: 0.2, z: 1.9, w: 0.22, h: 2.15, d: 1.05, color: PALETTE.woodDark },
    { x: 4.18, y: 0.2, z: 1.9, w: 0.22, h: 2.15, d: 1.05, color: PALETTE.woodDark },
  ];
}

export function DeclutterShelfScene({
  progress,
  celebrating = false,
}: {
  progress: number;
  celebrating?: boolean;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const visible = Math.round((1 - p) * CLUTTER.length);

  const paint = useMemo(
    () => (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const items = CLUTTER.map((c, i) => {
        if (i < visible) return c;
        if (i === visible && p > 0 && p < 1) {
          const fade = Math.max(0, 1 - (p * CLUTTER.length - visible));
          return { ...c, alpha: fade };
        }
        return null;
      }).filter(Boolean) as Block[];

      const plant: Block[] =
        p > 0.85
          ? [
              { x: 2.3, y: 0.3, z: 3.2, w: 0.45, h: 0.35, d: 0.45, color: PALETTE.wood },
              { x: 2.4, y: 0.65, z: 3.3, w: 0.25, h: 0.45, d: 0.25, color: PALETTE.mint },
            ]
          : [];

      const sparks: Block[] = celebrating
        ? Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + t * 2;
            const r = 0.4 + (t % 1.2) * 1.2;
            return {
              x: 2.4 + Math.cos(a) * r,
              y: 1.2 + (t % 1.2) * 1.4,
              z: 2.2 + Math.sin(a) * r,
              w: 0.2,
              h: 0.2,
              d: 0.2,
              color: i % 2 ? PALETTE.accent : PALETTE.coin,
              alpha: Math.max(0, 1 - (t % 1.2) / 1.2),
            };
          })
        : [];

      return paintBlocks(ctx, w, h, t, [...shelfFrame(), ...items, ...plant, ...sparks]);
    },
    [p, visible, celebrating],
  );

  return <IsoStage label="Kệ pixel 3D — hộc dần trống khi đồng hồ chạy" paint={paint} />;
}

export function WaitBagsScene({ bagCount, pulseKey = 0 }: { bagCount: number; pulseKey?: number }) {
  const count = Math.min(6, Math.max(0, bagCount));
  const paint = useMemo(
    () => (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const bench: Block = { x: 0.8, y: 0.15, z: 2.0, w: 4.2, h: 0.25, d: 1.2, color: PALETTE.woodDark };
      const bags: Block[] =
        count === 0
          ? [
              { x: 2.4, y: 0.45, z: 2.2, w: 0.8, h: 0.55, d: 0.6, color: PALETTE.bag, alpha: 0.4 },
              { x: 3.4, y: 0.55, z: 2.4, w: 0.3, h: 0.3, d: 0.3, color: PALETTE.coin, alpha: 0.5 },
            ]
          : Array.from({ length: count }, (_, i) => {
              const x = 1.1 + i * 0.75;
              const pulse = pulseKey > 0 && i === count - 1 ? Math.max(0, Math.sin(t * 10) * 0.25) : 0;
              return [
                { x, y: 0.45 + pulse, z: 2.2, w: 0.65, h: 0.55, d: 0.55, color: PALETTE.bag },
                { x: x + 0.2, y: 1.05 + pulse, z: 2.35, w: 0.25, h: 0.2, d: 0.25, color: PALETTE.coin },
              ] as Block[];
            }).flat();
      return paintBlocks(ctx, w, h, t, [bench, ...bags], { s: Math.min(w, h) * 0.08 });
    },
    [count, pulseKey],
  );
  return <IsoStage label="Túi pixel đang chờ — thèm mua và túi cửa" heightClass="h-36" paint={paint} />;
}

export function CoinJarScene({ fill, spendPulse = 0 }: { fill: number; spendPulse?: number }) {
  const coins = Math.round(Math.min(1, Math.max(0, fill)) * 10);
  const paint = useMemo(
    () => (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const bounce = spendPulse > 0 ? Math.max(0, Math.sin(t * 12) * 0.2) : 0;
      const jar: Block[] = [
        { x: 2.0, y: 0.15, z: 2.0, w: 1.8, h: 0.2, d: 1.4, color: PALETTE.woodDark },
        { x: 2.0, y: 0.15, z: 2.0, w: 0.2, h: 1.5, d: 1.4, color: PALETTE.wood },
        { x: 3.6, y: 0.15, z: 2.0, w: 0.2, h: 1.5, d: 1.4, color: PALETTE.wood },
        { x: 2.0, y: 0.15, z: 2.0, w: 1.8, h: 1.5, d: 0.2, color: PALETTE.woodDark },
      ];
      const n = Math.max(1, coins);
      const stack: Block[] = Array.from({ length: n }, (_, i) => ({
        x: 2.55,
        y: 0.4 + i * 0.14 + (i === n - 1 ? bounce : 0),
        z: 2.45,
        w: 0.7,
        h: 0.12,
        d: 0.7,
        color: coins === 0 ? PALETTE.muted : PALETTE.coin,
        alpha: coins === 0 ? 0.45 : 1,
      }));
      const warn: Block[] =
        fill > 0.92
          ? [{ x: 2.7, y: 1.8 + Math.abs(Math.sin(t * 3)) * 0.15, z: 2.5, w: 0.4, h: 0.4, d: 0.4, color: PALETTE.accent }]
          : [];
      return paintBlocks(ctx, w, h, t, [...jar, ...stack, ...warn], { s: Math.min(w, h) * 0.09 });
    },
    [coins, fill, spendPulse],
  );
  return <IsoStage label="Hũ tiền pixel — đầy dần khi chi không thiết yếu" heightClass="h-36" paint={paint} />;
}

export function ReleaseDoorScene({ doorOpen = 0 }: { doorOpen?: number }) {
  const open = Math.min(1, Math.max(0, doorOpen));
  const paint = useMemo(
    () => (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const swing = open * 1.1;
      const frame: Block[] = [
        { x: 1.6, y: 0.2, z: 1.8, w: 0.3, h: 2.4, d: 0.35, color: PALETTE.woodDark },
        { x: 3.8, y: 0.2, z: 1.8, w: 0.3, h: 2.4, d: 0.35, color: PALETTE.woodDark },
        { x: 1.6, y: 2.4, z: 1.8, w: 2.5, h: 0.25, d: 0.35, color: PALETTE.wood },
      ];
      const door: Block[] = [
        { x: 2.0 + swing * 0.15, y: 0.25, z: 1.95 + swing * 0.55, w: 1.6, h: 2.1, d: 0.18, color: PALETTE.door },
        { x: 3.2 + swing * 0.15, y: 1.1, z: 2.15 + swing * 0.55, w: 0.2, h: 0.2, d: 0.2, color: PALETTE.coin },
      ];
      const bag: Block[] =
        open > 0.4
          ? [{ x: 2.6, y: 0.35 + Math.sin(t * 2) * 0.05, z: 3.2, w: 0.7, h: 0.55, d: 0.55, color: PALETTE.bag }]
          : [];
      return paintBlocks(ctx, w, h, t, [...frame, ...door, ...bag], { s: Math.min(w, h) * 0.08 });
    },
    [open],
  );
  return <IsoStage label="Cửa pixel — mở khi bạn chốt buông đồ" heightClass="h-36" paint={paint} />;
}

export function FocusDeskScene({ working = false }: { working?: boolean }) {
  const paint = useMemo(
    () => (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      const desk: Block[] = [
        { x: 1.5, y: 0.7, z: 1.8, w: 2.8, h: 0.2, d: 1.4, color: PALETTE.wood },
        { x: 1.6, y: 0.15, z: 1.9, w: 0.25, h: 0.55, d: 0.25, color: PALETTE.woodDark },
        { x: 3.9, y: 0.15, z: 1.9, w: 0.25, h: 0.55, d: 0.25, color: PALETTE.woodDark },
        { x: 1.6, y: 0.15, z: 2.8, w: 0.25, h: 0.55, d: 0.25, color: PALETTE.woodDark },
        { x: 3.9, y: 0.15, z: 2.8, w: 0.25, h: 0.55, d: 0.25, color: PALETTE.woodDark },
        { x: 1.9, y: 0.95, z: 2.1, w: 1.0, h: 0.12, d: 0.8, color: PALETTE.fg },
        { x: 3.3, y: 0.95, z: 2.2, w: 0.2, h: 0.7, d: 0.2, color: PALETTE.muted },
        {
          x: 3.2,
          y: 1.65 + (working ? Math.sin(t * 3) * 0.06 : 0),
          z: 2.15,
          w: 0.4,
          h: 0.25,
          d: 0.4,
          color: working ? PALETTE.coin : PALETTE.grid,
        },
      ];
      return paintBlocks(ctx, w, h, t, desk, { bob: working, s: Math.min(w, h) * 0.085 });
    },
    [working],
  );
  return <IsoStage label="Bàn làm pixel — đèn sáng khi đang làm" heightClass="h-36" paint={paint} />;
}
