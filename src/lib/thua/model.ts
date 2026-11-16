export const PRACTICE_MS = 20 * 60 * 1000;
export const ACT_SLICE_MS = 25 * 60 * 1000;
export const ACT_TEN_MS = 10 * 60 * 1000;
export const URGE_MS = 10 * 60 * 1000;
export const HOLD_MS = 24 * 60 * 60 * 1000;
export const WAIT_MS = 48 * 60 * 60 * 1000;

export const INTENTION_PRESETS = [
  "Nếu thấy Sale → mở Thưa Chờ, không mở giỏ.",
  "Nếu stress / chán → hít thở 10 phút trước khi mở shop.",
  "Nếu đêm đói → uống nước, ghi muốn mua, không bấm đặt hàng.",
] as const;

export type Door = "keep" | "give" | "discard" | "hold";
export type Trigger = "bored" | "stress" | "sale" | "reward" | "night";

export const DOOR_LABEL: Record<Door, string> = {
  keep: "Giữ",
  give: "Cho đi",
  discard: "Bỏ",
  hold: "Túi cửa",
};

export const TRIGGERS: { id: Trigger; label: string }[] = [
  { id: "bored", label: "Chán" },
  { id: "stress", label: "Stress" },
  { id: "sale", label: "Sale" },
  { id: "reward", label: "Tự thưởng" },
  { id: "night", label: "Đêm, đói" },
];

export type Answers = {
  rebuy: boolean;
  guilt: boolean;
  currentLife: boolean;
};

export function suggest(a: Answers): { door: Door; reason: string } {
  if (a.currentLife && a.rebuy && !a.guilt) {
    return { door: "keep", reason: "Đang phục vụ đời này, và mất là mua lại. Giữ." };
  }
  if (!a.currentLife && !a.rebuy && !a.guilt) {
    return { door: "discard", reason: "Không mua lại, không thuộc đời đang sống. Bỏ." };
  }
  if (!a.currentLife && a.guilt) {
    return { door: "give", reason: "Giữ vì tiếc, không vì đang dùng. Cho người khác." };
  }
  if (a.currentLife && a.guilt) {
    return { door: "hold", reason: "Vừa còn dùng vừa tiếc. Để túi cửa một ngày." };
  }
  return { door: "hold", reason: "Tín hiệu lẫn. Túi cửa 24 giờ, hết cãi rồi hãy quyết." };
}

export function vnDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function vnLong(d = new Date()): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function weekId(d = new Date()): string {
  const [y, m, day] = vnDate(d).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dow = date.getUTCDay();
  const diff = dow === 0 ? 6 : dow - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

function shiftIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function streak(practices: string[], today = vnDate()): number {
  const set = new Set(practices);
  let cursor = set.has(today) ? today : shiftIso(today, -1);
  if (!set.has(cursor)) return 0;
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = shiftIso(cursor, -1);
  }
  return n;
}

export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))}₫`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatRemain(ms: number): string {
  if (ms <= 0) return "Đã tới giờ";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 48) return `${Math.floor(h / 24)} ngày`;
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  return `${m} phút`;
}

export type Timer = {
  running: boolean;
  startedAt: number | null;
  remainingMs: number;
};

export function timerLeft(timer: Timer, now: number): number {
  if (timer.running && timer.startedAt != null) {
    return Math.max(0, timer.remainingMs - (now - timer.startedAt));
  }
  return timer.remainingMs;
}
