/** Local due-reminders for túi cửa / 48h wants. No push server. */

export type Reminder = {
  id: string;
  kind: "hold" | "want";
  title: string;
  at: number;
  fired: boolean;
};

const STORAGE_KEY = "thua-reminders-v1";
const PREF_KEY = "thua-notif-pref";

export type NotifPref = "unknown" | "granted" | "denied" | "unsupported" | "skipped";

export function supportsNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotifPref(): NotifPref {
  if (typeof window === "undefined") return "unknown";
  if (!supportsNotifications()) return "unsupported";
  try {
    const saved = localStorage.getItem(PREF_KEY) as NotifPref | null;
    if (saved === "skipped" || saved === "denied" || saved === "granted") return saved;
  } catch {
    /* ignore */
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "unknown";
}

export function setNotifPref(pref: NotifPref) {
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {
    /* ignore */
  }
}

export async function registerThuaSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw-thua.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function requestNotifPermission(): Promise<NotifPref> {
  if (!supportsNotifications()) {
    setNotifPref("unsupported");
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    const pref: NotifPref = result === "granted" ? "granted" : result === "denied" ? "denied" : "unknown";
    setNotifPref(pref);
    return pref;
  } catch {
    setNotifPref("unsupported");
    return "unsupported";
  }
}

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Reminder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReminders(list: Reminder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 80)));
  } catch {
    /* ignore */
  }
}

export function upsertReminder(reminder: Omit<Reminder, "fired"> & { fired?: boolean }) {
  const list = loadReminders().filter((r) => r.id !== reminder.id);
  list.push({ ...reminder, fired: reminder.fired ?? false });
  saveReminders(list);
}

export function removeReminder(id: string) {
  saveReminders(loadReminders().filter((r) => r.id !== id));
}

async function showViaSW(title: string, body: string, tag: string, url: string) {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ type: "thua-notify", title, body, tag, url });
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export async function fireReminder(reminder: Reminder): Promise<boolean> {
  if (getNotifPref() !== "granted") return false;
  const title = reminder.kind === "hold" ? "Túi cửa đã hết hạn" : "Hết 48 giờ chờ mua";
  const body =
    reminder.kind === "hold"
      ? `${reminder.title} — quyết đi hoặc giữ.`
      : `${reminder.title} — còn muốn không?`;
  const url = "/?tab=wait";
  const viaSw = await showViaSW(title, body, `thua-${reminder.kind}-${reminder.id}`, url);
  if (viaSw) return true;
  try {
    new Notification(title, { body, tag: `thua-${reminder.kind}-${reminder.id}` });
    return true;
  } catch {
    return false;
  }
}

/** Mark due reminders fired and attempt notifications. Returns count newly due. */
export async function flushDueReminders(now = Date.now()): Promise<number> {
  const list = loadReminders();
  let count = 0;
  const next: Reminder[] = [];
  for (const r of list) {
    if (!r.fired && r.at <= now) {
      await fireReminder(r);
      next.push({ ...r, fired: true });
      count += 1;
    } else {
      next.push(r);
    }
  }
  saveReminders(next);
  return count;
}

export function countDueReminders(now = Date.now()): number {
  return loadReminders().filter((r) => !r.fired && r.at <= now).length;
}

export function countOpenDue(
  holds: { id: string; holdUntil: number | null; resolved: string }[],
  wants: { id: string; readyAt: number; status: string }[],
  now = Date.now(),
): number {
  const holdDue = holds.filter((h) => h.resolved === "open" && (h.holdUntil ?? 0) <= now).length;
  const wantDue = wants.filter((w) => w.status === "waiting" && w.readyAt <= now).length;
  return holdDue + wantDue;
}
