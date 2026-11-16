import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ACT_SLICE_MS,
  ACT_TEN_MS,
  HOLD_MS,
  PRACTICE_MS,
  URGE_MS,
  WAIT_MS,
  suggest,
  weekId,
  vnDate,
  type Answers,
  type Door,
  type Timer,
  type Trigger,
} from "@/lib/thua/model";
import { removeReminder, upsertReminder } from "@/lib/thua/reminders";

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
  forced?: boolean;
  linkedWantId?: string | null;
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

/** One-in / one-out debt after bringing a thing in. */
export type PendingOut = {
  dueDate: string;
  deferredOnce: boolean;
  reason: string;
};

export type AddSpendOpts = {
  thing?: boolean;
  forced?: boolean;
  linkedWantId?: string | null;
  /** Skip creating pending-out (caller already handled). */
  skipOut?: boolean;
};

type ThuaState = {
  weeklyCap: number | null;
  spends: Spend[];
  items: Item[];
  wants: Want[];
  practices: string[];
  timer: Timer;
  urge: Timer;
  focus: Focus | null;
  avoided: Avoided[];
  act: ActTimer;
  pendingOut: PendingOut | null;
  intentions: string[];
  practicePrompt: boolean;
  setCap: (n: number) => void;
  addSpend: (amount: number, note: string, opts?: AddSpendOpts) => void;
  addWant: (name: string, price: number, trigger: Trigger) => void;
  releaseWant: (id: string) => void;
  buyWant: (id: string) => boolean;
  /** Affirm a waiting want was purchased (after 48h friction gate). */
  settleWantPurchase: (id: string) => boolean;
  decide: (name: string, answers: Answers, door: Door) => void;
  resolveHold: (id: string, resolution: "released" | "kept") => void;
  startPractice: () => void;
  pausePractice: () => void;
  resetPractice: () => void;
  completePractice: () => void;
  dismissPracticePrompt: () => void;
  startUrge: () => void;
  pauseUrge: () => void;
  resetUrge: () => void;
  completeUrge: () => void;
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
  setIntentions: (lines: string[]) => void;
  releaseOut: (name: string, door: "give" | "discard") => void;
  deferPendingOut: () => boolean;
  clearPendingOut: () => void;
  clearAll: () => void;
};

const emptyTimer = (ms = PRACTICE_MS): Timer => ({
  running: false,
  startedAt: null,
  remainingMs: ms,
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

function markPendingOut(reason: string): PendingOut {
  return { dueDate: vnDate(), deferredOnce: false, reason };
}

const initial = {
  weeklyCap: null as number | null,
  spends: [] as Spend[],
  items: [] as Item[],
  wants: [] as Want[],
  practices: [] as string[],
  timer: emptyTimer(PRACTICE_MS),
  urge: emptyTimer(URGE_MS),
  focus: null as Focus | null,
  avoided: [] as Avoided[],
  act: emptyAct(),
  pendingOut: null as PendingOut | null,
  intentions: [] as string[],
  practicePrompt: false,
};

export const useThua = create<ThuaState>()(
  persist(
    (set, get) => ({
      ...initial,
      setCap: (n) => set({ weeklyCap: Math.max(0, Math.round(n)) }),
      addSpend: (amount, note, opts = {}) => {
        const thing = opts.thing ?? false;
        const at = Date.now();
        const spend: Spend = {
          id: uid(),
          amount: Math.round(amount),
          note: note.trim() || "Không ghi chú",
          at,
          weekId: weekId(new Date(at)),
          thing,
          forced: opts.forced ?? false,
          linkedWantId: opts.linkedWantId ?? null,
        };
        set((s) => ({
          spends: [spend, ...s.spends].slice(0, 200),
          pendingOut:
            thing && !opts.skipOut && !opts.forced
              ? s.pendingOut ?? markPendingOut(spend.note)
              : s.pendingOut,
        }));
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
        upsertReminder({ id: want.id, kind: "want", title: want.name, at: want.readyAt });
      },
      releaseWant: (id) => {
        set((s) => ({
          wants: s.wants.map((w) => (w.id === id && w.status === "waiting" ? { ...w, status: "released" } : w)),
        }));
        removeReminder(id);
      },
      buyWant: (id) => {
        const want = get().wants.find((w) => w.id === id);
        if (!want || want.status !== "waiting" || Date.now() < want.readyAt) return false;
        const spent = spentThisWeek(get().spends);
        const cap = get().weeklyCap;
        if (cap != null && spent > cap) return false;
        return get().settleWantPurchase(id);
      },
      settleWantPurchase: (id) => {
        const want = get().wants.find((w) => w.id === id);
        if (!want || want.status !== "waiting") return false;
        const at = Date.now();
        const spend: Spend = {
          id: uid(),
          amount: want.price,
          note: want.name,
          at,
          weekId: weekId(new Date(at)),
          thing: true,
          linkedWantId: id,
        };
        set((s) => ({
          wants: s.wants.map((w) => (w.id === id ? { ...w, status: "bought" } : w)),
          spends: [spend, ...s.spends].slice(0, 200),
          pendingOut: s.pendingOut ?? markPendingOut(want.name),
        }));
        removeReminder(id);
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
        if (item.holdUntil != null) {
          upsertReminder({ id: item.id, kind: "hold", title: item.name, at: item.holdUntil });
        }
      },
      resolveHold: (id, resolution) => {
        const item = get().items.find((it) => it.id === id);
        if (!item || item.door !== "hold" || item.resolved !== "open") return;
        // P0-3: both outcomes wait the full cooling-off window.
        if (item.holdUntil != null && Date.now() < item.holdUntil) return;
        const now = Date.now();
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, resolved: resolution, resolvedAt: now } : it,
          ),
        }));
        removeReminder(id);
      },
      startPractice: () =>
        set((s) => {
          if (s.act.running || s.urge.running) return s;
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
      resetPractice: () => set({ timer: emptyTimer(PRACTICE_MS) }),
      completePractice: () =>
        set((s) => {
          if (!s.timer.running && s.timer.remainingMs === PRACTICE_MS) return s;
          const day = vnDate();
          const practices = s.practices.includes(day) ? s.practices : [...s.practices, day];
          return { practices, timer: emptyTimer(PRACTICE_MS), practicePrompt: true };
        }),
      dismissPracticePrompt: () => set({ practicePrompt: false }),
      startUrge: () =>
        set((s) => {
          if (s.timer.running || s.act.running) return s;
          return {
            urge: {
              running: true,
              startedAt: Date.now(),
              remainingMs: s.urge.remainingMs > 0 && s.urge.remainingMs < URGE_MS ? s.urge.remainingMs : URGE_MS,
            },
          };
        }),
      pauseUrge: () =>
        set((s) => {
          if (!s.urge.running || s.urge.startedAt == null) return s;
          const left = Math.max(0, s.urge.remainingMs - (Date.now() - s.urge.startedAt));
          return { urge: { running: false, startedAt: null, remainingMs: left } };
        }),
      resetUrge: () => set({ urge: emptyTimer(URGE_MS) }),
      completeUrge: () => set({ urge: emptyTimer(URGE_MS) }),
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
          if (!s.focus || s.timer.running || s.urge.running || !s.focus.next.trim()) return s;
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
          if (!task || s.timer.running || s.urge.running) return s;
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
      setIntentions: (lines) =>
        set({
          intentions: lines
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 2),
        }),
      releaseOut: (name, door) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = Date.now();
        const item: Item = {
          id: uid(),
          name: trimmed,
          createdAt: now,
          door,
          reason: "Một vào một ra — chọn món ra sau khi đồ mới vào.",
          holdUntil: null,
          resolved: "released",
          resolvedAt: now,
        };
        set((s) => ({
          items: [item, ...s.items].slice(0, 80),
          pendingOut: null,
        }));
      },
      deferPendingOut: () => {
        const pending = get().pendingOut;
        if (!pending || pending.deferredOnce) return false;
        set({ pendingOut: { ...pending, deferredOnce: true, dueDate: vnDate() } });
        return true;
      },
      clearPendingOut: () => set({ pendingOut: null }),
      clearAll: () =>
        set({
          ...initial,
          timer: emptyTimer(PRACTICE_MS),
          urge: emptyTimer(URGE_MS),
          act: emptyAct(),
        }),
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
        urge: s.urge,
        focus: s.focus,
        avoided: s.avoided,
        act: s.act,
        pendingOut: s.pendingOut,
        intentions: s.intentions,
        practicePrompt: s.practicePrompt,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ThuaState>;
        return {
          ...current,
          ...saved,
          focus: saved.focus ?? null,
          avoided: saved.avoided ?? [],
          act: saved.act ?? emptyAct(),
          urge: saved.urge ?? emptyTimer(URGE_MS),
          pendingOut: saved.pendingOut ?? null,
          intentions: saved.intentions ?? [],
          practicePrompt: saved.practicePrompt ?? false,
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
  const out = items.filter(
    (it) => it.resolved === "released" && it.resolvedAt != null && weekId(new Date(it.resolvedAt)) === id,
  ).length;
  return { inn, out };
}

export function weekTriggerStats(wants: Want[], now = new Date()) {
  const id = weekId(now);
  const inWeek = wants.filter((w) => weekId(new Date(w.createdAt)) === id);
  const counts: Partial<Record<Trigger, number>> = {};
  for (const w of inWeek) {
    counts[w.trigger] = (counts[w.trigger] ?? 0) + 1;
  }
  const released = inWeek.filter((w) => w.status === "released").length;
  const bought = inWeek.filter((w) => w.status === "bought").length;
  const top = (Object.entries(counts) as [Trigger, number][]).sort((a, b) => b[1] - a[1])[0] ?? null;
  return { released, bought, top, total: inWeek.length };
}

export function weekReleasedCount(items: Item[], now = new Date()): number {
  const id = weekId(now);
  return items.filter(
    (it) => it.resolved === "released" && it.resolvedAt != null && weekId(new Date(it.resolvedAt)) === id,
  ).length;
}
