import { useEffect, useState } from "react";
import {
  getNotifPref,
  registerThuaSW,
  requestNotifPermission,
  setNotifPref,
  type NotifPref,
} from "@/lib/thua/reminders";

/** Soft one-time ask — never blocks core flows. */
export function NotifOptIn() {
  const [pref, setPref] = useState<NotifPref>("unknown");

  useEffect(() => {
    setPref(getNotifPref());
    void registerThuaSW();
  }, []);

  if (pref !== "unknown") return null;

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs tracking-widest text-muted uppercase">Nhắc nhẹ</p>
      <p className="mt-2 text-sm text-fg">Nhắc khi túi cửa / 48 giờ đến hạn?</p>
      <p className="mt-1 text-xs text-muted">
        Chỉ hỏi một lần. Trên iPhone cần cài ra Home Screen; nếu trình duyệt không cho, tab Chờ vẫn hiện badge khi mở lại.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="tap inline-flex min-h-11 flex-1 items-center justify-center rounded-card bg-accent px-3 text-sm font-medium text-accent-fg"
          onClick={async () => {
            const next = await requestNotifPermission();
            setPref(next);
          }}
        >
          Cho phép
        </button>
        <button
          type="button"
          className="tap inline-flex min-h-11 flex-1 items-center justify-center rounded-card border border-line px-3 text-sm text-muted"
          onClick={() => {
            setNotifPref("skipped");
            setPref("skipped");
          }}
        >
          Để sau
        </button>
      </div>
    </section>
  );
}
