import { useState } from "react";
import { useThua } from "@/lib/thua/store";
import { vnDate } from "@/lib/thua/model";
import clsx from "clsx";

/** P0-2: pick one item out after a thing comes in. */
export function OutSheet({ onOpenBuong }: { onOpenBuong?: () => void }) {
  const pendingOut = useThua((s) => s.pendingOut);
  const items = useThua((s) => s.items);
  const releaseOut = useThua((s) => s.releaseOut);
  const deferPendingOut = useThua((s) => s.deferPendingOut);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");

  if (!pendingOut) return null;

  const today = vnDate();
  const overdue = pendingOut.dueDate < today || (pendingOut.dueDate === today && pendingOut.deferredOnce);
  const kept = items.filter((i) => i.resolved === "kept").slice(0, 8);

  function pick(name: string, door: "give" | "discard") {
    releaseOut(name, door);
    setCustom("");
    setNote(`Đã chọn ra: ${name}`);
  }

  function defer() {
    const ok = deferPendingOut();
    setNote(ok ? "Để sau trong hôm nay. Chốt trước khi ngủ." : "Đã hết lần để sau — phải chọn một món ra.");
  }

  return (
    <section
      className={clsx(
        "rounded-card border p-4",
        overdue ? "border-accent bg-accent/10" : "border-line bg-surface",
      )}
    >
      <p className="text-xs tracking-widest text-muted uppercase">Một vào · một ra</p>
      <h2 className="mt-2 font-display text-2xl leading-tight">Đồ mới vào — chọn một món ra</h2>
      <p className="mt-2 text-sm text-muted">
        Vì vừa ghi “{pendingOut.reason}”. Luật 04: một món vào thì một món ra.
      </p>

      {kept.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {kept.map((item) => (
            <li key={item.id} className="flex gap-2">
              <button
                type="button"
                onClick={() => pick(item.name, "give")}
                className="tap min-h-11 flex-1 rounded-card border border-line bg-raised px-3 text-left text-sm"
              >
                Cho đi: {item.name}
              </button>
              <button
                type="button"
                onClick={() => pick(item.name, "discard")}
                className="tap min-h-11 rounded-card border border-line px-3 text-sm text-muted"
              >
                Bỏ
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-4 block">
        <span className="mb-2 block text-sm text-muted">Hoặc tên món khác</span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Áo cũ, hộp giày…"
          className="h-12 w-full rounded-card border border-line bg-raised px-4 text-base text-fg outline-none placeholder:text-muted focus:border-accent"
        />
      </label>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={!custom.trim()}
          onClick={() => pick(custom, "give")}
          className="tap inline-flex min-h-12 items-center justify-center rounded-card bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          Cho đi món này
        </button>
        <button
          type="button"
          disabled={!custom.trim()}
          onClick={() => pick(custom, "discard")}
          className="tap inline-flex min-h-12 items-center justify-center rounded-card border border-line bg-raised px-4 text-sm disabled:opacity-40"
        >
          Bỏ món này
        </button>
        {!pendingOut.deferredOnce && (
          <button type="button" onClick={defer} className="tap min-h-11 text-sm text-muted">
            Để sau trong hôm nay (một lần)
          </button>
        )}
        {onOpenBuong && (
          <button type="button" onClick={onOpenBuong} className="tap min-h-11 text-sm text-muted">
            Mở tab Buông để quyết kỹ hơn
          </button>
        )}
      </div>
      {note && <p className="mt-3 text-sm text-muted">{note}</p>}
    </section>
  );
}

export function PendingOutBadge({ onJump }: { onJump: () => void }) {
  const pendingOut = useThua((s) => s.pendingOut);
  if (!pendingOut) return null;
  const today = vnDate();
  const hot = pendingOut.dueDate < today || pendingOut.deferredOnce;
  return (
    <button
      type="button"
      onClick={onJump}
      className={clsx(
        "tap rounded-card border px-4 py-4 text-left",
        hot ? "border-accent bg-accent/15" : "border-line bg-surface",
      )}
    >
      <p className="text-sm text-fg">Còn một món phải ra{hot ? " — đến hạn" : ""}.</p>
      <p className="mt-1 text-xs text-muted">Vì “{pendingOut.reason}”. Chọn món ra để giữ luật một vào một ra.</p>
    </button>
  );
}
