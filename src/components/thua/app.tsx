import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type InputHTMLAttributes } from "react";
import clsx from "clsx";
import { Feather, Hourglass, Play, Sun, Wallet, Flame } from "lucide-react";
import {
  ACT_SLICE_MS,
  ACT_TEN_MS,
  DOOR_LABEL,
  INTENTION_PRESETS,
  PRACTICE_MS,
  TRIGGERS,
  URGE_MS,
  formatClock,
  formatMoney,
  formatRemain,
  streak,
  suggest,
  timerLeft,
  vnDate,
  vnLong,
  weekId,
  type Answers,
  type Door,
  type Trigger,
} from "@/lib/thua/model";
import {
  flowThisWeek,
  spentThisWeek,
  useThua,
  weekReleasedCount,
  weekTriggerStats,
} from "@/lib/thua/store";
import {
  CoinJarScene,
  DeclutterShelfScene,
  FocusDeskScene,
  ReleaseDoorScene,
  WaitBagsScene,
} from "@/components/thua/voxel";
import { OutSheet, PendingOutBadge } from "@/components/thua/out-sheet";
import { NotifOptIn } from "@/components/thua/reminders-ui";
import {
  countOpenDue,
  flushDueReminders,
  registerThuaSW,
  upsertReminder,
} from "@/lib/thua/reminders";

type Tab = "today" | "release" | "wait" | "money" | "act";

const LAWS = [
  { k: "01", t: "Một hộc, 20 phút, rồi dừng. Không dọn cả nhà." },
  { k: "02", t: "Ba cửa: giữ, cho đi, bỏ. “Để sau” chỉ được 24 giờ ở cửa." },
  { k: "03", t: "Thứ không thiết yếu phải chờ 48 giờ trước khi mua." },
  { k: "04", t: "Một món vào thì một món ra." },
  { k: "05", t: "Làm 10 phút bây giờ. Kế hoạch không tính là làm." },
];

export function ThuaApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let on = true;
    Promise.resolve(useThua.persist.rehydrate()).finally(() => {
      if (on) setReady(true);
    });
    return () => {
      on = false;
    };
  }, []);

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg">
        <p className="font-display text-5xl text-fg">Thưa</p>
      </main>
    );
  }

  return <Shell />;
}

function Shell() {
  const [tab, setTab] = useState<Tab>("today");
  const timer = useThua((s) => s.timer);
  const act = useThua((s) => s.act);
  const urge = useThua((s) => s.urge);
  const pendingOut = useThua((s) => s.pendingOut);
  const items = useThua((s) => s.items);
  const wants = useThua((s) => s.wants);
  const startUrge = useThua((s) => s.startUrge);
  const completePractice = useThua((s) => s.completePractice);
  const completeAct = useThua((s) => s.completeAct);
  const completeUrge = useThua((s) => s.completeUrge);
  const now = useNow(timer.running || act.running || urge.running);
  const left = timerLeft(timer, now);
  const actLeft = timerLeft(act, now);
  const urgeLeft = timerLeft(urge, now);

  useEffect(() => {
    if (timer.running && left <= 0) completePractice();
  }, [timer.running, left, completePractice]);

  useEffect(() => {
    if (act.running && actLeft <= 0) completeAct();
  }, [act.running, actLeft, completeAct]);

  useEffect(() => {
    if (urge.running && urgeLeft <= 0) completeUrge();
  }, [urge.running, urgeLeft, completeUrge]);

  // Deep-link: /?urge=1 or /?tab=wait&urge=1 or #urge
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const wantUrge = params.get("urge") === "1" || window.location.hash === "#urge";
    if (tabParam === "wait" || tabParam === "today" || tabParam === "money" || tabParam === "act" || tabParam === "release") {
      setTab(tabParam);
    }
    if (wantUrge) {
      setTab("wait");
      startUrge();
    }
    if (tabParam || wantUrge || window.location.hash === "#urge") {
      const url = new URL(window.location.href);
      url.searchParams.delete("urge");
      url.searchParams.delete("tab");
      url.hash = "";
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [startUrge]);

  // Reminders: SW + backfill schedules + flush when app opens / becomes visible
  useEffect(() => {
    void registerThuaSW();
    const state = useThua.getState();
    for (const item of state.items) {
      if (item.door === "hold" && item.resolved === "open" && item.holdUntil != null) {
        upsertReminder({ id: item.id, kind: "hold", title: item.name, at: item.holdUntil });
      }
    }
    for (const want of state.wants) {
      if (want.status === "waiting") {
        upsertReminder({ id: want.id, kind: "want", title: want.name, at: want.readyAt });
      }
    }
    void flushDueReminders();
    const onVis = () => {
      if (document.visibilityState === "visible") void flushDueReminders();
    };
    document.addEventListener("visibilitychange", onVis);
    const onMsg = (event: MessageEvent) => {
      if (event.data?.type === "thua-open") setTab("wait");
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
    };
  }, []);

  const waitDueOut =
    pendingOut != null && (pendingOut.deferredOnce || pendingOut.dueDate < vnDate());
  const waitDueTimers = countOpenDue(
    items.filter((i) => i.door === "hold"),
    wants,
    now,
  );
  const choBadge = waitDueTimers > 0;
  const showUrgeFab = tab !== "wait" && !urge.running && !timer.running && !act.running;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <main className="mx-auto w-full max-w-md px-5 pt-8 pb-28">
        {tab === "today" && <Today onJump={setTab} />}
        {tab === "release" && <Release />}
        {tab === "wait" && <Wait onJump={setTab} />}
        {tab === "money" && <Money onJump={setTab} />}
        {tab === "act" && <Act />}
      </main>

      {showUrgeFab && (
        <button
          type="button"
          onClick={() => {
            startUrge();
            setTab("wait");
          }}
          className="tap fixed right-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-card bg-accent px-4 text-sm font-medium text-accent-fg shadow-lg"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
          aria-label="Đang thèm — mở cưỡi cơn thèm"
        >
          <Flame className="size-4" strokeWidth={2} aria-hidden="true" />
          Đang thèm
        </button>
      )}

      <nav className="dock fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg" aria-label="Chính">
        <div className="mx-auto flex max-w-md">
          <TabButton id="today" tab={tab} setTab={setTab} label="Hôm nay" icon={Sun} badge={waitDueOut} />
          <TabButton id="act" tab={tab} setTab={setTab} label="Làm" icon={Play} />
          <TabButton id="release" tab={tab} setTab={setTab} label="Buông" icon={Feather} />
          <TabButton id="wait" tab={tab} setTab={setTab} label="Chờ" icon={Hourglass} badge={choBadge} />
          <TabButton id="money" tab={tab} setTab={setTab} label="Tiền" icon={Wallet} />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  id,
  tab,
  setTab,
  label,
  icon: Icon,
  badge = false,
}: {
  id: Tab;
  tab: Tab;
  setTab: (t: Tab) => void;
  label: string;
  icon: typeof Sun;
  badge?: boolean;
}) {
  const on = tab === id;
  return (
    <button
      type="button"
      aria-current={on ? "page" : undefined}
      onClick={() => setTab(id)}
      className={clsx(
        "tap relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs",
        on ? "text-fg" : "text-muted",
      )}
    >
      <span className={clsx("h-0.5 w-4 rounded-full", on ? "bg-accent" : "bg-transparent")} />
      <span className="relative">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
        {badge && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-accent" aria-hidden="true" />}
      </span>
      {label}
    </button>
  );
}

function Today({ onJump }: { onJump: (t: Tab) => void }) {
  const practices = useThua((s) => s.practices);
  const timer = useThua((s) => s.timer);
  const urge = useThua((s) => s.urge);
  const startPractice = useThua((s) => s.startPractice);
  const pausePractice = useThua((s) => s.pausePractice);
  const resetPractice = useThua((s) => s.resetPractice);
  const weeklyCap = useThua((s) => s.weeklyCap);
  const spends = useThua((s) => s.spends);
  const items = useThua((s) => s.items);
  const wants = useThua((s) => s.wants);
  const focus = useThua((s) => s.focus);
  const avoided = useThua((s) => s.avoided);
  const act = useThua((s) => s.act);
  const practicePrompt = useThua((s) => s.practicePrompt);
  const dismissPracticePrompt = useThua((s) => s.dismissPracticePrompt);
  const startUrge = useThua((s) => s.startUrge);

  const ticking = timer.running || act.running || urge.running;
  const now = useNow(ticking || wants.some((w) => w.status === "waiting") || items.some((i) => i.resolved === "open"));
  const left = timerLeft(timer, now);
  const actLeft = timerLeft(act, now);

  const today = vnDate();
  const done = practices.includes(today);
  const days = streak(practices, today);
  const paused = !timer.running && timer.remainingMs < PRACTICE_MS;
  const spent = spentThisWeek(spends);
  const flow = flowThisWeek(items, spends);
  const holds = items.filter((i) => i.resolved === "open").length;
  const waiting = wants.filter((w) => w.status === "waiting").length;
  const capLeft = weeklyCap == null ? null : weeklyCap - spent;
  const triggers = weekTriggerStats(wants);
  const releasedWeek = weekReleasedCount(items);
  const overCap = weeklyCap != null && capLeft != null && capLeft < 0;

  const shelfProgress =
    done && !timer.running && !paused
      ? 1
      : timer.running || paused
        ? Math.min(1, Math.max(0, 1 - left / PRACTICE_MS))
        : 0;

  const [celebrate, setCelebrate] = useState(false);
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      setCelebrate(true);
      const id = window.setTimeout(() => setCelebrate(false), 1800);
      wasDone.current = done;
      return () => window.clearTimeout(id);
    }
    wasDone.current = done;
  }, [done]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-display text-5xl leading-none text-fg">Thưa</p>
        <p className="mt-3 text-sm text-muted capitalize">{vnLong()}</p>
        <p className="mt-4 max-w-xs text-lg leading-snug text-fg">Ít đồ. Ít tiền ra. Nhiều chỗ để sống.</p>
      </header>

      <PendingOutBadge onJump={() => onJump("money")} />

      {overCap && (
        <div className="rounded-card border border-accent bg-accent/10 px-4 py-3">
          <p className="text-sm text-fg">Tuần này đã vượt mức — tạm khóa “Vẫn mua” đến thứ Hai.</p>
          <p className="mt-1 text-xs text-muted">Vẫn được ghi chi bắt buộc và bấm Không mua trên Chờ.</p>
        </div>
      )}

      <DeclutterShelfScene progress={shelfProgress} celebrating={celebrate} />

      <section className="rounded-card border border-line bg-surface p-5">
        <p className="text-xs tracking-widest text-muted uppercase">Một hộc</p>
        <h2 className="mt-2 font-display text-3xl leading-tight">Một hộc. Hai mươi phút.</h2>
        <p className="mt-2 text-sm text-muted">Khóa máy cũng được. Đồng hồ chạy theo giờ thật, không theo màn hình.</p>
        <p className="mt-2 text-xs text-muted">
          {shelfProgress <= 0
            ? "Kệ pixel còn đầy — bắt đầu 20 phút để thưa dần."
            : shelfProgress >= 1
              ? "Kệ đã trống. Chỗ thở trở lại."
              : "Đồ trên kệ đang biến mất theo từng phút."}
        </p>

        <p className="mt-5 font-display text-6xl tabular-nums leading-none" aria-live="polite">
          {formatClock(timer.running || paused ? left : PRACTICE_MS)}
        </p>
        <p className="mt-3 text-sm text-muted">
          {done ? "Hôm nay đã giữ nhịp." : "Hôm nay chưa làm."}
          {days > 0 ? ` ${days} ngày liên tiếp.` : ""}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {!timer.running && !paused && !done && (
            <Btn onClick={startPractice} disabled={act.running || urge.running}>
              {act.running || urge.running ? "Đang làm việc khác" : "Bắt đầu 20 phút"}
            </Btn>
          )}
          {timer.running && <Btn onClick={pausePractice}>Tạm dừng</Btn>}
          {paused && (
            <>
              <Btn onClick={startPractice}>Tiếp tục</Btn>
              <Btn tone="ghost" onClick={resetPractice}>
                Bỏ phiên này
              </Btn>
            </>
          )}
          {!timer.running && !paused && done && (
            <Btn tone="quiet" onClick={startPractice}>
              Thêm một hộc
            </Btn>
          )}
        </div>
      </section>

      {practicePrompt && (
        <section className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs tracking-widest text-muted uppercase">Hộc xong</p>
          <h2 className="mt-2 font-display text-2xl leading-tight">Vừa đụng mấy món?</h2>
          <p className="mt-2 text-sm text-muted">
            Tuần này đã thả {releasedWeek} món. Nếu vừa thấy thứ không thuộc đời đang sống — đưa sang Buông ngay.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Btn
              onClick={() => {
                dismissPracticePrompt();
                onJump("release");
              }}
            >
              Mở Buông
            </Btn>
            <Btn tone="ghost" onClick={dismissPracticePrompt}>
              Để sau
            </Btn>
          </div>
        </section>
      )}

      {!urge.running && !act.running && (
        <button
          type="button"
          onClick={() => {
            startUrge();
            onJump("wait");
          }}
          disabled={timer.running}
          className="tap rounded-card border border-accent/40 bg-accent/10 p-4 text-left disabled:opacity-40"
        >
          <p className="text-xs tracking-widest text-accent uppercase">Đang thèm</p>
          <p className="mt-2 text-sm text-fg">Chờ 10 phút. Không mở shop. Cưỡi cơn thèm rồi mới quyết.</p>
          <p className="mt-2 text-xs text-muted">Shortcut: mở app với ?urge=1</p>
        </button>
      )}

      <ActionHint
        onJump={onJump}
        focusName={focus?.name ?? null}
        sliceToday={focus?.slices.includes(today) ?? false}
        pushed={avoided.filter((a) => !a.done && !a.starts.includes(today)).length}
        running={act.running}
        clock={formatClock(act.running ? actLeft : 0)}
      />

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onJump("money")} className="tap rounded-card border border-line bg-surface p-4 text-left">
          <p className="text-xs text-muted">Tuần này còn</p>
          <p className="mt-2 font-display text-2xl tabular-nums leading-none">
            {capLeft == null ? "—" : formatMoney(Math.max(0, capLeft))}
          </p>
          <p className="mt-2 text-xs text-muted">
            {weeklyCap == null
              ? "Chưa đặt mức"
              : capLeft != null && capLeft < 0
                ? `Vượt ${formatMoney(-capLeft)}`
                : `trong ${formatMoney(weeklyCap)}`}
          </p>
        </button>
        <button type="button" onClick={() => onJump("release")} className="tap rounded-card border border-line bg-surface p-4 text-left">
          <p className="text-xs text-muted">Đồ vào / ra</p>
          <p className="mt-2 font-display text-2xl tabular-nums leading-none">
            {flow.inn} · {flow.out}
          </p>
          <p className="mt-2 text-xs text-muted">
            {flow.inn === 0 && flow.out === 0
              ? "Chưa có đồ mới"
              : flow.out >= flow.inn
                ? "Cửa ra đang rộng"
                : "Đồ vào nhiều hơn ra"}
          </p>
        </button>
      </div>

      {triggers.total > 0 && (
        <section className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs tracking-widest text-muted uppercase">Tuần này</p>
          <p className="mt-2 text-sm text-fg">
            Thả {triggers.released} · mua {triggers.bought}
            {triggers.top
              ? ` · hay gặp: ${TRIGGERS.find((t) => t.id === triggers.top![0])?.label ?? ""} (${triggers.top[1]})`
              : ""}
            .
          </p>
          {triggers.top?.[0] === "sale" && (
            <p className="mt-2 text-xs text-muted">Sale đang kéo bạn — bật Chờ trước khi mở app shop.</p>
          )}
          {triggers.top?.[0] === "stress" && (
            <p className="mt-2 text-xs text-muted">Stress đang kéo tay — cưỡi cơn thèm 10 phút trước khi mua.</p>
          )}
        </section>
      )}

      {(holds > 0 || waiting > 0) && (
        <button type="button" onClick={() => onJump("wait")} className="tap rounded-card border border-line bg-surface px-4 py-4 text-left">
          <p className="text-sm text-fg">
            {holds > 0 ? `${holds} món trong túi cửa` : "Túi cửa đang trống"}
            {waiting > 0 ? ` · ${waiting} thứ đang chờ mua` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">Mở hàng chờ</p>
        </button>
      )}

      <section className="pt-2">
        <p className="text-xs tracking-widest text-muted uppercase">Năm luật</p>
        <ol className="mt-3 flex flex-col">
          {LAWS.map((law) => (
            <li key={law.k} className="flex gap-4 border-t border-line py-3">
              <span className="font-display text-sm text-accent">{law.k}</span>
              <span className="text-sm leading-relaxed">{law.t}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Release() {
  const decide = useThua((s) => s.decide);
  const items = useThua((s) => s.items);
  const [name, setName] = useState("");
  const [rebuy, setRebuy] = useState<boolean | null>(null);
  const [guilt, setGuilt] = useState<boolean | null>(null);
  const [life, setLife] = useState<boolean | null>(null);
  const [override, setOverride] = useState<{ key: string; door: Door } | null>(null);
  const [note, setNote] = useState("");
  const [doorOpen, setDoorOpen] = useState(0);

  const ready = name.trim().length > 0 && rebuy != null && guilt != null && life != null;
  const answers: Answers | null =
    rebuy != null && guilt != null && life != null ? { rebuy, guilt, currentLife: life } : null;
  const suggestion = answers ? suggest(answers) : null;
  const key = `${rebuy}-${guilt}-${life}`;
  const door = suggestion ? (override && override.key === key ? override.door : suggestion.door) : null;

  useEffect(() => {
    if (note) {
      setDoorOpen(1);
      const id = window.setTimeout(() => setDoorOpen(0.15), 1400);
      return () => window.clearTimeout(id);
    }
    setDoorOpen(suggestion ? 0.35 : 0);
  }, [suggestion, note]);

  function commit() {
    if (!ready || !answers || !door) return;
    decide(name, answers, door);
    setNote(`${name.trim()} → ${DOOR_LABEL[door]}`);
    setName("");
    setRebuy(null);
    setGuilt(null);
    setLife(null);
    setOverride(null);
  }

  const recent = items.slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs tracking-widest text-muted uppercase">Buông</p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Ba câu, một cửa.</h1>
      </header>

      <ReleaseDoorScene doorOpen={doorOpen} />

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <Field label="Món đang nắm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Áo mưa, cáp, hộp giày…" />

        <Choice
          legend="Nếu mất hôm nay, mình có mua lại?"
          value={rebuy}
          onChange={setRebuy}
          options={[
            { label: "Có, mua lại", value: true },
            { label: "Không", value: false },
          ]}
        />
        <Choice
          legend="Mình đang giữ vì điều gì?"
          value={guilt}
          onChange={setGuilt}
          options={[
            { label: "Tiếc tiền, tội lỗi", value: true },
            { label: "Vì còn dùng", value: false },
          ]}
        />
        <Choice
          legend="Nó phục vụ đời nào?"
          value={life}
          onChange={setLife}
          options={[
            { label: "Đời đang sống", value: true },
            { label: "Đời tưởng tượng", value: false },
          ]}
        />

        {suggestion && door && (
          <div className="rounded-card border border-line bg-surface p-4">
            <p className="text-sm leading-relaxed">{suggestion.reason}</p>
            {door !== suggestion.door && (
              <p className="mt-2 text-xs text-muted">Đang chọn khác gợi ý. Quyết vẫn là của mình.</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(Object.keys(DOOR_LABEL) as Door[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setOverride({ key, door: d })}
                  className={clsx(
                    "tap min-h-12 rounded-card border text-sm",
                    door === d ? "border-accent bg-accent text-accent-fg" : "border-line bg-raised text-fg",
                  )}
                >
                  {DOOR_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        )}

        <Btn type="submit" disabled={!ready}>
          Chốt
        </Btn>
        {note && <p className="text-sm text-muted">{note}</p>}
      </form>

      <section>
        <p className="text-xs tracking-widest text-muted uppercase">Vừa quyết</p>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Chưa buông món nào. Bắt đầu bằng thứ đang nằm trên bàn.</p>
        ) : (
          <ul className="mt-2">
            {recent.map((item) => (
              <li key={item.id} className="border-t border-line py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 break-words text-sm">{item.name}</p>
                  <p className="shrink-0 text-xs text-muted">{DOOR_LABEL[item.door]}</p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {item.resolved === "open" ? "Đang ở túi cửa" : item.resolved === "kept" ? "Đã giữ" : "Đã rời đi"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Wait({ onJump }: { onJump: (t: Tab) => void }) {
  const wants = useThua((s) => s.wants);
  const items = useThua((s) => s.items);
  const addWant = useThua((s) => s.addWant);
  const releaseWant = useThua((s) => s.releaseWant);
  const buyWant = useThua((s) => s.buyWant);
  const resolveHold = useThua((s) => s.resolveHold);
  const weeklyCap = useThua((s) => s.weeklyCap);
  const spends = useThua((s) => s.spends);
  const urge = useThua((s) => s.urge);
  const startUrge = useThua((s) => s.startUrge);
  const pauseUrge = useThua((s) => s.pauseUrge);
  const resetUrge = useThua((s) => s.resetUrge);
  const timer = useThua((s) => s.timer);
  const act = useThua((s) => s.act);
  const intentions = useThua((s) => s.intentions);
  const setIntentions = useThua((s) => s.setIntentions);

  const openHolds = items.filter((i) => i.door === "hold" && i.resolved === "open");
  const waiting = wants.filter((w) => w.status === "waiting");
  const active = openHolds.length > 0 || waiting.length > 0 || urge.running;
  const now = useNow(active);
  const spent = spentThisWeek(spends);
  const room = weeklyCap == null ? null : weeklyCap - spent;
  const overCap = weeklyCap != null && room != null && room < 0;
  const urgeLeft = timerLeft(urge, now);
  const urgePaused = !urge.running && urge.remainingMs > 0 && urge.remainingMs < URGE_MS;
  const [urgeFinished, setUrgeFinished] = useState(false);
  const wasUrge = useRef(urge.running);
  useEffect(() => {
    if (wasUrge.current && !urge.running && urge.remainingMs === URGE_MS) {
      setUrgeFinished(true);
    }
    wasUrge.current = urge.running;
  }, [urge.running, urge.remainingMs]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [trigger, setTrigger] = useState<Trigger>("sale");
  const [pulseKey, setPulseKey] = useState(0);
  const [editingIntent, setEditingIntent] = useState(intentions.length === 0);
  const bagCount = openHolds.length + waiting.length;
  const busy = timer.running || act.running;

  function add(e: FormEvent) {
    e.preventDefault();
    const n = Number(price);
    if (!name.trim() || !Number.isFinite(n) || n <= 0) return;
    addWant(name, n, trigger);
    setPulseKey((k) => k + 1);
    setUrgeFinished(false);
    setName("");
    setPrice("");
  }

  function toggleIntention(line: string) {
    if (intentions.includes(line)) {
      setIntentions(intentions.filter((i) => i !== line));
    } else if (intentions.length < 2) {
      setIntentions([...intentions, line]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs tracking-widest text-muted uppercase">Chờ</p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Chưa mua, chưa vứt.</h1>
      </header>

      <WaitBagsScene bagCount={bagCount} pulseKey={pulseKey} />

      <NotifOptIn />

      <section className="rounded-card border border-line bg-surface p-5">
        <p className="text-xs tracking-widest text-muted uppercase">Cưỡi cơn thèm</p>
        <h2 className="mt-2 font-display text-3xl leading-tight">Đang thèm — 10 phút.</h2>
        <p className="mt-2 text-sm text-muted">Cơn thèm lên rồi xuống. Không mở shop. Không nhảy sang Tiền.</p>
        {intentions.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {intentions.map((line) => (
              <li key={line} className="text-sm text-fg">
                {line}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 font-display text-6xl tabular-nums leading-none" aria-live="polite">
          {formatClock(urge.running || urgePaused ? urgeLeft : URGE_MS)}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {!urge.running && !urgePaused && (
            <Btn onClick={startUrge} disabled={busy}>
              {busy ? "Đang làm việc khác" : "Bắt đầu 10 phút"}
            </Btn>
          )}
          {urge.running && <Btn onClick={pauseUrge}>Tạm dừng</Btn>}
          {urgePaused && (
            <>
              <Btn onClick={startUrge} disabled={busy}>
                Tiếp tục
              </Btn>
              <Btn tone="ghost" onClick={resetUrge}>
                Bỏ phiên này
              </Btn>
            </>
          )}
        </div>
        {urgeFinished && !urge.running && !urgePaused && (
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <p className="text-sm text-muted">Hết 10 phút. Còn muốn mua không?</p>
            <Btn
              onClick={() => {
                setUrgeFinished(false);
                document.getElementById("wait-form")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Để chờ 48 giờ
            </Btn>
            <Btn
              tone="quiet"
              onClick={() => {
                setUrgeFinished(false);
                resetUrge();
              }}
            >
              Không mua
            </Btn>
            <Btn
              tone="ghost"
              onClick={() => {
                setUrgeFinished(false);
                startUrge();
              }}
            >
              Vẫn thèm — cưỡi thêm 10 phút
            </Btn>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm text-fg">Câu if–then</h2>
        <p className="mt-1 text-sm text-muted">Tối đa hai câu. Hiện lại khi cưỡi cơn thèm.</p>
        {editingIntent || intentions.length === 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {INTENTION_PRESETS.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => toggleIntention(line)}
                className={clsx(
                  "tap min-h-12 rounded-card border px-3 text-left text-sm",
                  intentions.includes(line) ? "border-accent bg-raised text-fg" : "border-line text-muted",
                )}
              >
                {line}
              </button>
            ))}
            <Btn tone="ghost" onClick={() => setEditingIntent(false)}>
              Xong
            </Btn>
          </div>
        ) : (
          <button type="button" onClick={() => setEditingIntent(true)} className="tap mt-3 text-sm text-muted">
            Sửa câu lệnh
          </button>
        )}
      </section>

      <section>
        <h2 className="text-sm text-fg">Túi cửa</h2>
        <p className="mt-1 text-sm text-muted">
          Hết một ngày rồi hãy nhận là mình chọn giữ. Cả “cho đi” và “giữ lại” đều chờ đủ 24 giờ.
        </p>
        {openHolds.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Túi đang trống.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {openHolds.map((item) => {
              const remain = (item.holdUntil ?? 0) - now;
              const due = remain <= 0;
              return (
                <li key={item.id} className="rounded-card border border-line bg-surface p-4">
                  <p className="break-words text-sm">{item.name}</p>
                  <p className="mt-1 text-xs text-muted">{due ? "Đã tới giờ quyết" : formatRemain(remain)}</p>
                  <div className="mt-3 flex gap-2">
                    <Btn className="flex-1" disabled={!due} onClick={() => resolveHold(item.id, "released")}>
                      Đã cho đi
                    </Btn>
                    <Btn tone="quiet" className="flex-1" disabled={!due} onClick={() => resolveHold(item.id, "kept")}>
                      Giữ lại
                    </Btn>
                  </div>
                  {!due && <p className="mt-2 text-xs text-muted">Chưa hết 24 giờ — không giữ sớm.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="wait-form">
        <h2 className="text-sm text-fg">48 giờ</h2>
        <p className="mt-1 text-sm text-muted">Thèm mua thì ghi ở đây. Đừng mở app shop trong lúc chờ.</p>
        <form onSubmit={add} className="mt-4 flex flex-col gap-3">
          <Field label="Thứ muốn mua" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tai nghe, áo, đồ decor…" />
          <MoneyField label="Giá" digits={price} onDigits={setPrice} />
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Đang cảm thấy</legend>
            <div className="flex flex-wrap gap-2">
              {TRIGGERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTrigger(t.id)}
                  className={clsx(
                    "tap min-h-11 rounded-full border px-3 text-sm",
                    trigger === t.id ? "border-accent bg-accent text-accent-fg" : "border-line text-muted",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Btn type="submit" disabled={!name.trim() || Number(price) <= 0}>
            Để chờ
          </Btn>
        </form>

        {waiting.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Chưa có thứ nào đang chờ.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {waiting.map((want) => {
              const remain = want.readyAt - now;
              const due = remain <= 0;
              const triggerLabel = TRIGGERS.find((t) => t.id === want.trigger)?.label ?? "";
              const over = room != null && want.price > Math.max(0, room);
              return (
                <li key={want.id} className="rounded-card border border-line bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 break-words text-sm">{want.name}</p>
                    <p className="shrink-0 font-display text-lg tabular-nums">{formatMoney(want.price)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {triggerLabel} · {formatRemain(remain)}
                  </p>
                  {due && (
                    <p className="mt-2 text-xs text-muted">
                      Vẫn muốn vì cần dùng, hay vì trigger {triggerLabel}?
                    </p>
                  )}
                  {due && over && room != null && (
                    <p className="mt-2 text-xs text-accent">
                      Mua món này thì vượt mức tuần {formatMoney(want.price - Math.max(0, room))}.
                    </p>
                  )}
                  {due && overCap && (
                    <p className="mt-2 text-xs text-accent">Tuần này đã vượt mức — tạm khóa mua đến thứ Hai.</p>
                  )}
                  <div className="mt-3 flex flex-col gap-2">
                    <Btn tone="solid" onClick={() => releaseWant(want.id)}>
                      Không mua
                    </Btn>
                    {due ? (
                      <Btn
                        tone="quiet"
                        disabled={overCap}
                        onClick={() => {
                          const ok = buyWant(want.id);
                          if (ok) onJump("money");
                        }}
                      >
                        {overCap ? "Đã khóa mua tuần này" : "Vẫn muốn — ghi chi (đồ)"}
                      </Btn>
                    ) : (
                      <p className="flex min-h-12 items-center text-xs text-muted">Chưa hết 48 giờ</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionHint({
  onJump,
  focusName,
  sliceToday,
  pushed,
  running,
  clock,
}: {
  onJump: (t: Tab) => void;
  focusName: string | null;
  sliceToday: boolean;
  pushed: number;
  running: boolean;
  clock: string;
}) {
  let title = "Chưa chọn việc chính.";
  let detail = "Mở tab Làm để đặt một việc và một bước kế tiếp.";
  if (running) {
    title = focusName ? `Đang làm: ${focusName}` : "Đang làm 10 phút.";
    detail = `Còn ${clock}. Giữ nhịp, đừng mở app khác.`;
  } else if (focusName) {
    title = sliceToday ? `${focusName} — đã cắt lát hôm nay.` : `${focusName} đang chờ một lát.`;
    detail =
      pushed > 0
        ? `${pushed} việc đang né. Sang Làm để bắt đầu.`
        : "Một lát 25 phút hoặc ghi việc đang né.";
  } else if (pushed > 0) {
    title = `${pushed} việc đang né.`;
    detail = "Mười phút bắt đầu là đủ. Không cần kế hoạch dài.";
  }

  return (
    <button type="button" onClick={() => onJump("act")} className="tap rounded-card border border-line bg-surface p-4 text-left">
      <p className="text-xs tracking-widest text-muted uppercase">Làm</p>
      <p className="mt-2 text-sm leading-snug text-fg">{title}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </button>
  );
}

function Act() {
  const focus = useThua((s) => s.focus);
  const avoided = useThua((s) => s.avoided);
  const act = useThua((s) => s.act);
  const timer = useThua((s) => s.timer);
  const openFocus = useThua((s) => s.openFocus);
  const setNext = useThua((s) => s.setNext);
  const closeFocus = useThua((s) => s.closeFocus);
  const addAvoided = useThua((s) => s.addAvoided);
  const finishAvoided = useThua((s) => s.finishAvoided);
  const startSlice = useThua((s) => s.startSlice);
  const startTen = useThua((s) => s.startTen);
  const pauseAct = useThua((s) => s.pauseAct);
  const resetAct = useThua((s) => s.resetAct);

  const [focusName, setFocusName] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [avoidName, setAvoidName] = useState("");
  const [note, setNote] = useState("");

  const now = useNow(act.running);
  const left = timerLeft(act, now);
  const paused = !act.running && act.kind != null && act.remainingMs > 0;
  const openAvoided = avoided.filter((a) => !a.done);
  const today = vnDate();
  const urge = useThua((s) => s.urge);
  const practiceBusy = timer.running || urge.running;

  function createFocus(e: FormEvent) {
    e.preventDefault();
    openFocus(focusName, nextStep);
    setFocusName("");
    setNextStep("");
  }

  function createAvoided(e: FormEvent) {
    e.preventDefault();
    const ok = addAvoided(avoidName);
    setNote(ok ? "" : "Tối đa 3 việc đang né.");
    if (ok) setAvoidName("");
  }

  const defaultMs = act.kind === "ten" ? ACT_TEN_MS : ACT_SLICE_MS;
  const shownMs = act.running || paused ? left : defaultMs;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs tracking-widest text-muted uppercase">Làm</p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Một việc. Một lát.</h1>
        <p className="mt-2 text-sm text-muted">25 phút cho việc chính, hoặc 10 phút cho thứ đang né. Kế hoạch không tính là làm.</p>
      </header>

      <FocusDeskScene working={act.running} />

      {(act.running || paused) && (
        <section className="rounded-card border border-line bg-surface p-5">
          <p className="text-xs tracking-widest text-muted uppercase">
            {act.kind === "ten" ? "Mười phút" : "Một lát"}
          </p>
          <p className="mt-2 font-display text-6xl tabular-nums leading-none" aria-live="polite">
            {formatClock(shownMs)}
          </p>
          <p className="mt-3 text-sm text-muted">
            {act.kind === "ten"
              ? openAvoided.find((a) => a.id === act.taskId)?.name ?? "Việc đang né"
              : focus
                ? `Bước kế: ${focus.next}`
                : "Đang làm"}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {act.running && <Btn onClick={pauseAct}>Tạm dừng</Btn>}
            {paused && (
              <>
                <Btn
                  onClick={() => {
                    if (act.kind === "ten" && act.taskId) startTen(act.taskId);
                    else startSlice();
                  }}
                  disabled={practiceBusy}
                >
                  {practiceBusy ? "Đang dọn hộc" : "Tiếp tục"}
                </Btn>
                <Btn tone="ghost" onClick={resetAct}>
                  Bỏ phiên này
                </Btn>
              </>
            )}
          </div>
        </section>
      )}

      <section className="rounded-card border border-line bg-surface p-5">
        <p className="text-xs tracking-widest text-muted uppercase">Việc chính</p>
        {focus ? (
          <>
            <h2 className="mt-2 font-display text-3xl leading-tight">{focus.name}</h2>
            <p className="mt-2 text-sm text-muted">
              {focus.slices.includes(today) ? "Đã cắt một lát hôm nay." : "Chưa cắt lát hôm nay."}
            </p>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-muted">Bước kế tiếp</span>
              <input
                value={focus.next}
                onChange={(e) => setNext(e.target.value)}
                className="h-12 w-full rounded-card border border-line bg-raised px-4 text-base text-fg outline-none transition-colors duration-200 placeholder:text-muted focus:border-accent"
                placeholder="Mở file, viết đoạn đầu…"
              />
            </label>
            <div className="mt-4 flex flex-col gap-2">
              {!act.running && !paused && (
                <Btn onClick={startSlice} disabled={practiceBusy || !focus.next.trim()}>
                  {practiceBusy ? "Đang dọn hộc" : "Bắt đầu 25 phút"}
                </Btn>
              )}
              <Btn tone="ghost" onClick={closeFocus}>
                Đổi việc chính
              </Btn>
            </div>
          </>
        ) : (
          <form onSubmit={createFocus} className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-muted">Chọn một việc thôi. Không danh sách.</p>
            <Field label="Việc chính" value={focusName} onChange={(e) => setFocusName(e.target.value)} placeholder="Viết, dọn, sửa…" />
            <Field label="Bước kế tiếp" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Mở doc, xếp 5 món…" />
            <Btn type="submit" disabled={!focusName.trim() || !nextStep.trim()}>
              Đặt việc
            </Btn>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-sm text-fg">Việc đang né</h2>
        <p className="mt-1 text-sm text-muted">Tối đa ba. Mười phút bắt đầu — xong thì đánh dấu, chưa xong thì vẫn được.</p>
        <form onSubmit={createAvoided} className="mt-4 flex flex-col gap-3">
          <Field label="Việc né" value={avoidName} onChange={(e) => setAvoidName(e.target.value)} placeholder="Gọi điện, trả lời mail…" />
          <Btn type="submit" disabled={!avoidName.trim() || openAvoided.length >= 3}>
            Thêm
          </Btn>
          {note && <p className="text-sm text-muted">{note}</p>}
        </form>
        {openAvoided.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Chưa ghi việc nào đang né.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {openAvoided.map((task) => {
              const started = task.starts.includes(today);
              return (
                <li key={task.id} className="rounded-card border border-line bg-surface p-4">
                  <p className="break-words text-sm">{task.name}</p>
                  <p className="mt-1 text-xs text-muted">{started ? "Đã bắt đầu hôm nay." : "Chưa đụng hôm nay."}</p>
                  <div className="mt-3 flex gap-2">
                    {!act.running && (
                      <Btn
                        className="flex-1"
                        onClick={() => startTen(task.id)}
                        disabled={practiceBusy || (paused && !(act.kind === "ten" && act.taskId === task.id))}
                      >
                        {paused && act.kind === "ten" && act.taskId === task.id
                          ? "Tiếp tục 10 phút"
                          : practiceBusy
                            ? "Đang dọn hộc"
                            : "Làm 10 phút"}
                      </Btn>
                    )}
                    <Btn tone="quiet" onClick={() => finishAvoided(task.id)}>
                      Xong
                    </Btn>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Money({ onJump }: { onJump: (t: Tab) => void }) {
  const weeklyCap = useThua((s) => s.weeklyCap);
  const setCap = useThua((s) => s.setCap);
  const spends = useThua((s) => s.spends);
  const wants = useThua((s) => s.wants);
  const addSpend = useThua((s) => s.addSpend);
  const addWant = useThua((s) => s.addWant);
  const settleWantPurchase = useThua((s) => s.settleWantPurchase);
  const clearAll = useThua((s) => s.clearAll);

  const [capDigits, setCapDigits] = useState("");
  const [editing, setEditing] = useState(weeklyCap == null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [thing, setThing] = useState(false);
  const [armedClear, setArmedClear] = useState(false);
  const [spendPulse, setSpendPulse] = useState(0);
  const [gate, setGate] = useState<"idle" | "ask">("idle");
  const [linkWantId, setLinkWantId] = useState<string | null>(null);

  const spent = spentThisWeek(spends);
  const weekSpends = spends.filter((s) => s.weekId === weekId());
  const left = weeklyCap == null ? null : weeklyCap - spent;
  const ratio = weeklyCap && weeklyCap > 0 ? Math.min(1, spent / weeklyCap) : Math.min(1, spent > 0 ? 0.2 : 0);
  const waitingThings = wants.filter((w) => w.status === "waiting");

  function saveCap(e: FormEvent) {
    e.preventDefault();
    if (capDigits === "") return;
    setCap(Number(capDigits));
    setCapDigits("");
    setEditing(false);
  }

  function saveSpend(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    // P0-4: friction for things / large nonessential spends
    const needsGate = thing || (weeklyCap != null && weeklyCap > 0 && n >= weeklyCap * 0.15);
    if (needsGate && gate === "idle") {
      setGate("ask");
      return;
    }
    commitSpend({ forced: false, linkedWantId: linkWantId });
  }

  function commitSpend(opts: { forced: boolean; linkedWantId: string | null }) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    addSpend(n, note, {
      thing,
      forced: opts.forced,
      linkedWantId: opts.linkedWantId,
    });
    setSpendPulse((k) => k + 1);
    setAmount("");
    setNote("");
    setThing(false);
    setGate("idle");
    setLinkWantId(null);
  }

  function sendToWait() {
    const n = Number(amount);
    if (!note.trim() || !Number.isFinite(n) || n <= 0) return;
    addWant(note, n, "sale");
    setAmount("");
    setNote("");
    setThing(false);
    setGate("idle");
    onJump("wait");
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs tracking-widest text-muted uppercase">Tiền</p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Không thiết yếu.</h1>
        <p className="mt-2 text-sm text-muted">Ăn cơ bản, đi lại, thuốc, hóa đơn không tính. Cà phê, sale, tự thưởng thì tính.</p>
      </header>

      <OutSheet onOpenBuong={() => onJump("release")} />

      <CoinJarScene fill={ratio} spendPulse={spendPulse} />

      <section className="rounded-card border border-line bg-surface p-5">
        <p className="text-xs text-muted">Còn lại tuần này</p>
        <p className="mt-2 font-display text-5xl tabular-nums leading-none">
          {left == null ? "—" : formatMoney(Math.max(0, left))}
        </p>
        {left != null && left < 0 && (
          <p className="mt-2 text-sm text-accent">
            Vượt {formatMoney(-left)}. “Vẫn mua” trên Chờ tạm khóa đến thứ Hai.
          </p>
        )}
        {weeklyCap != null && weeklyCap > 0 && (
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
            <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
          </div>
        )}
        <p className="mt-3 text-sm text-muted">
          Đã ghi {formatMoney(spent)}
          {weeklyCap != null ? ` / ${formatMoney(weeklyCap)}` : ""}
        </p>
        {!editing && weeklyCap != null && (
          <button type="button" className="tap mt-3 text-sm text-muted" onClick={() => setEditing(true)}>
            Đổi mức tuần
          </button>
        )}
        {(editing || weeklyCap == null) && (
          <form onSubmit={saveCap} className="mt-4 flex flex-col gap-2">
            <MoneyField label="Mức tuần" digits={capDigits} onDigits={setCapDigits} />
            <Btn type="submit" disabled={capDigits === ""}>
              Đặt mức
            </Btn>
          </form>
        )}
      </section>

      {gate === "ask" ? (
        <section className="rounded-card border border-accent bg-accent/10 p-4">
          <p className="text-sm text-fg">Đã chờ 48 giờ chưa?</p>
          <p className="mt-2 text-xs text-muted">
            Luật 03: thứ không thiết yếu phải chờ. Đừng lách bằng ghi chi thẳng.
          </p>
          {waitingThings.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-muted">Có, đã trong Chờ:</p>
              {waitingThings.slice(0, 4).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    settleWantPurchase(w.id);
                    setSpendPulse((k) => k + 1);
                    setAmount("");
                    setNote("");
                    setThing(false);
                    setGate("idle");
                    setLinkWantId(null);
                  }}
                  className="tap min-h-11 rounded-card border border-line bg-surface px-3 text-left text-sm"
                >
                  {w.name} · {formatMoney(w.price)}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Btn onClick={sendToWait}>Chưa — đưa vào Chờ thay vì ghi</Btn>
            <Btn tone="quiet" onClick={() => commitSpend({ forced: true, linkedWantId: null })}>
              Mua bắt buộc (thuốc, hỏng, thay thế)
            </Btn>
            <Btn tone="ghost" onClick={() => setGate("idle")}>
              Quay lại
            </Btn>
          </div>
        </section>
      ) : (
        <form onSubmit={saveSpend} className="flex flex-col gap-3">
          <p className="text-sm text-muted">Đã mua rồi thì ghi, đừng giấu. Đang thèm thì sang tab Chờ, đừng ghi trước.</p>
          <MoneyField label="Số tiền" digits={amount} onDigits={setAmount} />
          <Field label="Là gì" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cà phê, áo, phí ship…" />
          <label className="flex min-h-12 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={thing}
              onChange={(e) => setThing(e.target.checked)}
              className="size-5"
            />
            Đây là đồ vật — tính vào cửa vào
          </label>
          <Btn type="submit" disabled={Number(amount) <= 0}>
            Ghi chi
          </Btn>
        </form>
      )}

      <section>
        <p className="text-xs tracking-widest text-muted uppercase">Tuần này</p>
        {weekSpends.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Chưa ghi khoản nào. Tuần tính từ thứ Hai.</p>
        ) : (
          <ul className="mt-2">
            {weekSpends.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 border-t border-line py-3">
                <p className="min-w-0 break-words text-sm">
                  {s.note}
                  {s.thing ? <span className="text-muted"> · đồ</span> : null}
                  {s.forced ? <span className="text-muted"> · bắt buộc</span> : null}
                </p>
                <p className="shrink-0 font-display tabular-nums">{formatMoney(s.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pt-4">
        {armedClear ? (
          <div className="flex gap-2">
            <Btn
              tone="quiet"
              onClick={() => {
                clearAll();
                setArmedClear(false);
                setEditing(true);
              }}
            >
              Chắc chắn xóa
            </Btn>
            <Btn tone="ghost" onClick={() => setArmedClear(false)}>
              Thôi
            </Btn>
          </div>
        ) : (
          <Btn tone="ghost" onClick={() => setArmedClear(true)}>
            Xóa dữ liệu trên máy này
          </Btn>
        )}
      </div>
    </div>
  );
}

function Choice({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  options: { label: string; value: boolean }[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm leading-relaxed text-fg">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <Pick key={option.label} on={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </Pick>
        ))}
      </div>
    </fieldset>
  );
}

function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "tap min-h-12 rounded-card border px-2 text-sm",
        on ? "border-accent bg-raised text-fg" : "border-line text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded-card border border-line bg-surface px-4 text-base text-fg outline-none transition-colors duration-200 placeholder:text-muted focus:border-accent"
      />
    </label>
  );
}

function MoneyField({ label, digits, onDigits }: { label: string; digits: string; onDigits: (d: string) => void }) {
  const shown = digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
  return (
    <Field
      label={label}
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={shown}
      onChange={(e) => onDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
    />
  );
}

function Btn({
  tone = "solid",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "solid" | "quiet" | "ghost" }) {
  return (
    <button
      type={type}
      className={clsx(
        "tap inline-flex min-h-12 items-center justify-center rounded-card px-4 text-sm font-medium disabled:opacity-40",
        tone === "solid" && "bg-accent text-accent-fg",
        tone === "quiet" && "border border-line bg-raised text-fg",
        tone === "ghost" && "text-muted",
        className,
      )}
      {...props}
    />
  );
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return active ? now : Date.now();
}
