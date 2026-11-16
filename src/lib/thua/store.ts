import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ACT_SLICE_MS,
  ACT_TEN_MS,
  HOLD_MS,
  PRACTICE_MS,
  WAIT_MS,
  suggest,
  weekId,
  vnDate,
  type Answers,
  type Door,
  type Timer,
  type Trigger,
} from "@/lib/thua/model";

export type Item = {
  id: string;
  name: string;
  createdAt: number;
  door: Door;
  reason: string;
  holdUntil: number | null;
  resolved: "open" | "released" | "kept";
  resolvedAt: number | null;
};

export type Want = {
  id: string;
  name: string;
  price: number;
  trigger: Trigger;
  createdAt: number;
  readyAt: number;
  status: "waiting" | "bought" | "released";
};

export type Spend = {
  id: string;
  amount: number;
  note: string;
  at: number;
  weekId: string;
  thing: boolean;
};

export type Focus = {
  name: string;
  next: string;
  slices: string[];
};

export type Avoided = {
  id: string;
  name: string;
  starts: string[];
  done: boolean;
};

export type ActTimer = Timer & {
  kind: "slice" | "ten" | null;
  taskId: string | null;
};

type ThuaState = {
  weeklyCap: number | null;
  spends: Spend[];
  items: Item[];
  wants: Want[];
  practices: string[];
  timer: Timer;
  focus: Focus | null;
  avoided: Avoided[];
  act: ActTimer;
  setCap: (n: number) => void;
  addSpend: (amount: number, note: string, thing: boolean) => void;
  addWant: (name: string, price: number, trigger: Trigger) => void;
  releaseWant: (id: string) => void;
  buyWant: (id: string) => boolean;
  decide: (name: string, answers: Answers, door: Door) => void;
  resolveHold: (id: string, resolution: "released" | "kept") => void;
  startPractice: () => void;
  pausePractice: () => void;
  resetPractice: () => void;
  completePractice: () => void;
  openFocus: (name: string, next: string) => void;
  setNext: (next: string) => void;
  closeFocus: () => void;
  addAvoided: (name: string) => boolean;
  startSlice: () => void;
  startTen: (id: string) => void;
  pauseAct: () => void;
  resetAct: () => void;
  completeAct: () => void;
  finishAvoided: (id: string) => void;
  clearAll: () => void;
};

const emptyTimer = (): Timer => ({
  running: false,
  startedAt: null,
  remainingMs: PRACTICE_MS,
});

function uid(): string {
  return crypto.randomUUID();
}

const emptyAct = (): ActTimer => ({
  running: false,
  startedAt: null,
  remainingMs: ACT_SLICE_MS,
  kind: null,
  taskId: null,
});

const initial = {
  weeklyCap: null as number | null,
  spends: [] as Spend[],
  items: [] as Item[],
  wants: [] as Want[],
  practices: [] as string[],
  timer: emptyTimer(),
  focus: null as Focus | null,
  avoided: [] as Avoided[],
  act: emptyAct(),
};

export const useThua = create<ThuaState>()(
  persist(
    (set, get) => ({
      ...initial,
      setCap: (n) => set({ weeklyCap: Math.max(0, Math.round(n)) }),
      addSpend: (amount, note, thing) => {
        const at = Date.now();
        const spend: Spend = {
          id: uid(),
          amount: Math.round(amount),
          note: note.trim() || "Không ghi chú",
          at,
          weekId: weekId(new Date(at)),
          thing,
        };
        set((s) => ({ spends: [spend, ...s.spends].slice(0, 200) }));
      },
      addWant: (name, price, trigger) => {
        const createdAt = Date.now();
        const want: Want = {
          id: uid(),
          name: name.trim(),
          price: Math.round(price),
          trigger,
          createdAt,
          readyAt: createdAt + WAIT_MS,
          status: "waiting",
        };
        set((s) => ({ wants: [want, ...s.wants].slice(0, 80) }));
      },
      releaseWant: (id) =>
        set((s) => ({
          wants: s.wants.map((w) => (w.id === id && w.status === "waiting" ? { ...w, status: "released" } : w)),
        })),
      buyWant: (id) => {
        const want = get().wants.find((w) => w.id === id);
        if (!want || want.status !== "waiting" || Date.now() < want.readyAt) return false;
        const at = Date.now();
        const spend: Spend = {
          id: uid(),
          amount: want.price,
          note: want.name,
          at,
          weekId: weekId(new Date(at)),
          thing: true,
        };
        set((s) => ({
          wants: s.wants.map((w) => (w.id === id ? { ...w, status: "bought" } : w)),
          spends: [spend, ...s.spends].slice(0, 200),
        }));
        return true;
      },
      decide: (name, answers, door) => {
        const { reason } = suggest(answers);
        const now = Date.now();
        const item: Item = {
          id: uid(),
          name: name.trim(),
          createdAt: now,
          door,
          reason,
          holdUntil: door === "hold" ? now + HOLD_MS : null,
          resolved: door === "hold" ? "open" : door === "keep" ? "kept" : "released",
          resolvedAt: door === "hold" ? null : now,
        };
        set((s) => ({ items: [item, ...s.items].slice(0, 80) }));
      },
      resolveHold: (id, resolution) => {
        const item = get().items.find((it) => it.id === id);
        if (!item || item.door !== "hold" || item.resolved !== "open") return;
        if (resolution === "released" && item.holdUntil != null && Date.now() < item.holdUntil) return;
        const now = Date.now();
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, resolved: resolution, resolvedAt: now } : it,
          ),
        }));
      },
      startPractice: () =>
        set((s) => {
          if (s.act.running) return s;
          return {
            timer: {
              running: true,
              startedAt: Date.now(),
              remainingMs: s.timer.remainingMs > 0 ? s.timer.remainingMs : PRACTICE_MS,
            },
          };
        }),
      pausePractice: () =>
        set((s) => {
          if (!s.timer.running || s.timer.startedAt == null) return s;
          const left = Math.max(0, s.timer.remainingMs - (Date.now() - s.timer.startedAt));
          return { timer: { running: false, startedAt: null, remainingMs: left } };
        }),
      resetPractice: () => set({ timer: emptyTimer() }),
      completePractice: () =>
        set((s) => {
          if (!s.timer.running && s.timer.remainingMs === PRACTICE_MS) return s;
          const day = vnDate();
          const practices = s.practices.includes(day) ? s.practices : [...s.practices, day];
          return { practices, timer: emptyTimer() };
        }),
      openFocus: (name, next) =>
        set((s) => {
          if (s.focus || !name.trim() || !next.trim()) return s;
          return { focus: { name: name.trim(), next: next.trim(), slices: [] } };
        }),
      setNext: (next) =>
        set((s) => (s.focus ? { focus: { ...s.focus, next: next.trim() } } : s)),
      closeFocus: () => set({ focus: null, act: emptyAct() }),
      addAvoided: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        if (get().avoided.filter((a) => !a.done).length >= 3) return false;
        const task: Avoided = { id: uid(), name: trimmed, starts: [], done: false };
        set((s) => ({ avoided: [task, ...s.avoided].slice(0, 40) }));
        return true;
      },
      startSlice: () =>
        set((s) => {
          if (!s.focus || s.timer.running || !s.focus.next.trim()) return s;
          const resume = !s.act.running && s.act.kind === "slice" && s.act.remainingMs < ACT_SLICE_MS;
          return {
            act: {
              running: true,
              startedAt: Date.now(),
              remainingMs: resume ? s.act.remainingMs : ACT_SLICE_MS,
              kind: "slice",
              taskId: null,
            },
          };
        }),
      startTen: (id) =>
        set((s) => {
          const task = s.avoided.find((a) => a.id === id && !a.done);
          if (!task || s.timer.running) return s;
          const resume = !s.act.running && s.act.kind === "ten" && s.act.taskId === id && s.act.remainingMs < ACT_TEN_MS;
          return {
            act: {
              running: true,
              startedAt: Date.now(),
              remainingMs: resume ? s.act.remainingMs : ACT_TEN_MS,
              kind: "ten",
              taskId: id,
            },
          };
        }),
      pauseAct: () =>
        set((s) => {
          if (!s.act.running || s.act.startedAt == null) return s;
          const left = Math.max(0, s.act.remainingMs - (Date.now() - s.act.startedAt));
          return { act: { ...s.act, running: false, startedAt: null, remainingMs: left } };
        }),
      resetAct: () => set({ act: emptyAct() }),
      completeAct: () =>
        set((s) => {
          if (!s.act.running && s.act.kind == null) return s;
          const day = vnDate();
          let focus = s.focus;
          let avoided = s.avoided;
          if (s.act.kind === "slice" && focus && !focus.slices.includes(day)) {
            focus = { ...focus, slices: [...focus.slices, day] };
          }
          if (s.act.kind === "ten" && s.act.taskId) {
            avoided = avoided.map((a) =>
              a.id === s.act.taskId && !a.starts.includes(day) ? { ...a, starts: [...a.starts, day] } : a,
            );
          }
          return { focus, avoided, act: emptyAct() };
        }),
      finishAvoided: (id) =>
        set((s) => ({
          avoided: s.avoided.map((a) => (a.id === id ? { ...a, done: true } : a)),
        })),
      clearAll: () => set({ ...initial, timer: emptyTimer(), act: emptyAct() }),
    }),
    {
      name: "thua-v1",
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        weeklyCap: s.weeklyCap,
        spends: s.spends,
        items: s.items,
        wants: s.wants,
        practices: s.practices,
        timer: s.timer,
        focus: s.focus,
        avoided: s.avoided,
        act: s.act,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ThuaState>;
        return {
          ...current,
          ...saved,
          focus: saved.focus ?? null,
          avoided: saved.avoided ?? [],
          act: saved.act ?? emptyAct(),
        };
      },
    },
  ),
);

export function spentThisWeek(spends: Spend[], now = new Date()): number {
  const id = weekId(now);
  return spends.filter((s) => s.weekId === id).reduce((sum, s) => sum + s.amount, 0);
}

export function flowThisWeek(items: Item[], spends: Spend[], now = new Date()) {
  const id = weekId(now);
  const inn = spends.filter((s) => s.weekId === id && s.thing).length;
  const out = items.filter((it) => it.resolved === "released" && it.resolvedAt != null && weekId(new Date(it.resolvedAt)) === id).length;
  return { inn, out };
}
