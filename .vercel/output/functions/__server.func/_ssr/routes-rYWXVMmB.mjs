import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Feather, i as Hourglass, r as Sun, t as Wallet } from "../_libs/lucide-react.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-rYWXVMmB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PRACTICE_MS = 12e5;
var HOLD_MS = 864e5;
var WAIT_MS = 1728e5;
var DOOR_LABEL = {
	keep: "Giữ",
	give: "Cho đi",
	discard: "Bỏ",
	hold: "Túi cửa"
};
var TRIGGERS = [
	{
		id: "bored",
		label: "Chán"
	},
	{
		id: "stress",
		label: "Stress"
	},
	{
		id: "sale",
		label: "Sale"
	},
	{
		id: "reward",
		label: "Tự thưởng"
	},
	{
		id: "night",
		label: "Đêm, đói"
	}
];
function suggest(a) {
	if (a.currentLife && a.rebuy && !a.guilt) return {
		door: "keep",
		reason: "Đang phục vụ đời này, và mất là mua lại. Giữ."
	};
	if (!a.currentLife && !a.rebuy && !a.guilt) return {
		door: "discard",
		reason: "Không mua lại, không thuộc đời đang sống. Bỏ."
	};
	if (!a.currentLife && a.guilt) return {
		door: "give",
		reason: "Giữ vì tiếc, không vì đang dùng. Cho người khác."
	};
	if (a.currentLife && a.guilt) return {
		door: "hold",
		reason: "Vừa còn dùng vừa tiếc. Để túi cửa một ngày."
	};
	return {
		door: "hold",
		reason: "Tín hiệu lẫn. Túi cửa 24 giờ, hết cãi rồi hãy quyết."
	};
}
function vnDate(d = /* @__PURE__ */ new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(d);
}
function vnLong(d = /* @__PURE__ */ new Date()) {
	return new Intl.DateTimeFormat("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		weekday: "long",
		day: "numeric",
		month: "long"
	}).format(d);
}
function weekId(d = /* @__PURE__ */ new Date()) {
	const [y, m, day] = vnDate(d).split("-").map(Number);
	const date = new Date(Date.UTC(y, m - 1, day));
	const dow = date.getUTCDay();
	const diff = dow === 0 ? 6 : dow - 1;
	date.setUTCDate(date.getUTCDate() - diff);
	return date.toISOString().slice(0, 10);
}
function shiftIso(iso, delta) {
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	date.setUTCDate(date.getUTCDate() + delta);
	return date.toISOString().slice(0, 10);
}
function streak(practices, today = vnDate()) {
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
function formatMoney(n) {
	return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))}₫`;
}
function formatClock(ms) {
	const total = Math.max(0, Math.ceil(ms / 1e3));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function formatRemain(ms) {
	if (ms <= 0) return "Đã tới giờ";
	const totalMin = Math.ceil(ms / 6e4);
	const h = Math.floor(totalMin / 60);
	const m = totalMin % 60;
	if (h >= 48) return `${Math.floor(h / 24)} ngày`;
	if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
	return `${m} phút`;
}
function timerLeft(timer, now) {
	if (timer.running && timer.startedAt != null) return Math.max(0, timer.remainingMs - (now - timer.startedAt));
	return timer.remainingMs;
}
var emptyTimer = () => ({
	running: false,
	startedAt: null,
	remainingMs: PRACTICE_MS
});
function uid() {
	return crypto.randomUUID();
}
var initial = {
	weeklyCap: null,
	spends: [],
	items: [],
	wants: [],
	practices: [],
	timer: emptyTimer()
};
var useThua = create()(persist((set, get) => ({
	...initial,
	setCap: (n) => set({ weeklyCap: Math.max(0, Math.round(n)) }),
	addSpend: (amount, note, thing) => {
		const at = Date.now();
		const spend = {
			id: uid(),
			amount: Math.round(amount),
			note: note.trim() || "Không ghi chú",
			at,
			weekId: weekId(new Date(at)),
			thing
		};
		set((s) => ({ spends: [spend, ...s.spends].slice(0, 200) }));
	},
	addWant: (name, price, trigger) => {
		const createdAt = Date.now();
		const want = {
			id: uid(),
			name: name.trim(),
			price: Math.round(price),
			trigger,
			createdAt,
			readyAt: createdAt + WAIT_MS,
			status: "waiting"
		};
		set((s) => ({ wants: [want, ...s.wants].slice(0, 80) }));
	},
	releaseWant: (id) => set((s) => ({ wants: s.wants.map((w) => w.id === id && w.status === "waiting" ? {
		...w,
		status: "released"
	} : w) })),
	buyWant: (id) => {
		const want = get().wants.find((w) => w.id === id);
		if (!want || want.status !== "waiting" || Date.now() < want.readyAt) return false;
		const at = Date.now();
		const spend = {
			id: uid(),
			amount: want.price,
			note: want.name,
			at,
			weekId: weekId(new Date(at)),
			thing: true
		};
		set((s) => ({
			wants: s.wants.map((w) => w.id === id ? {
				...w,
				status: "bought"
			} : w),
			spends: [spend, ...s.spends].slice(0, 200)
		}));
		return true;
	},
	decide: (name, answers, door) => {
		const { reason } = suggest(answers);
		const now = Date.now();
		const item = {
			id: uid(),
			name: name.trim(),
			createdAt: now,
			door,
			reason,
			holdUntil: door === "hold" ? now + HOLD_MS : null,
			resolved: door === "hold" ? "open" : door === "keep" ? "kept" : "released",
			resolvedAt: door === "hold" ? null : now
		};
		set((s) => ({ items: [item, ...s.items].slice(0, 80) }));
	},
	resolveHold: (id, resolution) => {
		const item = get().items.find((it) => it.id === id);
		if (!item || item.door !== "hold" || item.resolved !== "open") return;
		if (resolution === "released" && item.holdUntil != null && Date.now() < item.holdUntil) return;
		const now = Date.now();
		set((s) => ({ items: s.items.map((it) => it.id === id ? {
			...it,
			resolved: resolution,
			resolvedAt: now
		} : it) }));
	},
	startPractice: () => set((s) => ({ timer: {
		running: true,
		startedAt: Date.now(),
		remainingMs: s.timer.remainingMs > 0 ? s.timer.remainingMs : PRACTICE_MS
	} })),
	pausePractice: () => set((s) => {
		if (!s.timer.running || s.timer.startedAt == null) return s;
		return { timer: {
			running: false,
			startedAt: null,
			remainingMs: Math.max(0, s.timer.remainingMs - (Date.now() - s.timer.startedAt))
		} };
	}),
	resetPractice: () => set({ timer: emptyTimer() }),
	completePractice: () => set((s) => {
		if (!s.timer.running && s.timer.remainingMs === 12e5) return s;
		const day = vnDate();
		return {
			practices: s.practices.includes(day) ? s.practices : [...s.practices, day],
			timer: emptyTimer()
		};
	}),
	clearAll: () => set({
		...initial,
		timer: emptyTimer()
	})
}), {
	name: "thua-v1",
	skipHydration: true,
	storage: createJSONStorage(() => localStorage),
	partialize: (s) => ({
		weeklyCap: s.weeklyCap,
		spends: s.spends,
		items: s.items,
		wants: s.wants,
		practices: s.practices,
		timer: s.timer
	})
}));
function spentThisWeek(spends, now = /* @__PURE__ */ new Date()) {
	const id = weekId(now);
	return spends.filter((s) => s.weekId === id).reduce((sum, s) => sum + s.amount, 0);
}
function flowThisWeek(items, spends, now = /* @__PURE__ */ new Date()) {
	const id = weekId(now);
	return {
		inn: spends.filter((s) => s.weekId === id && s.thing).length,
		out: items.filter((it) => it.resolved === "released" && it.resolvedAt != null && weekId(new Date(it.resolvedAt)) === id).length
	};
}
var LAWS = [
	{
		k: "01",
		t: "Một hộc, 20 phút, rồi dừng. Không dọn cả nhà."
	},
	{
		k: "02",
		t: "Ba cửa: giữ, cho đi, bỏ. “Để sau” chỉ được 24 giờ ở cửa."
	},
	{
		k: "03",
		t: "Thứ không thiết yếu phải chờ 48 giờ trước khi mua."
	},
	{
		k: "04",
		t: "Một món vào thì một món ra."
	}
];
function ThuaApp() {
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let on = true;
		Promise.resolve(useThua.persist.rehydrate()).finally(() => {
			if (on) setReady(true);
		});
		return () => {
			on = false;
		};
	}, []);
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-5xl text-fg",
			children: "Thưa"
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, {});
}
function Shell() {
	const [tab, setTab] = (0, import_react.useState)("today");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto w-full max-w-md px-5 pt-8 pb-28",
			children: [
				tab === "today" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Today, { onJump: setTab }),
				tab === "release" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Release, {}),
				tab === "wait" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wait, {}),
				tab === "money" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
			className: "dock fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg",
			"aria-label": "Chính",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
						id: "today",
						tab,
						setTab,
						label: "Hôm nay",
						icon: Sun
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
						id: "release",
						tab,
						setTab,
						label: "Buông",
						icon: Feather
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
						id: "wait",
						tab,
						setTab,
						label: "Chờ",
						icon: Hourglass
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
						id: "money",
						tab,
						setTab,
						label: "Tiền",
						icon: Wallet
					})
				]
			})
		})]
	});
}
function TabButton({ id, tab, setTab, label, icon: Icon }) {
	const on = tab === id;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		"aria-current": on ? "page" : void 0,
		onClick: () => setTab(id),
		className: clsx("tap flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs", on ? "text-fg" : "text-muted"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: clsx("h-0.5 w-4 rounded-full", on ? "bg-accent" : "bg-transparent") }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
				className: "size-5",
				strokeWidth: 1.75,
				"aria-hidden": "true"
			}),
			label
		]
	});
}
function Today({ onJump }) {
	const practices = useThua((s) => s.practices);
	const timer = useThua((s) => s.timer);
	const startPractice = useThua((s) => s.startPractice);
	const pausePractice = useThua((s) => s.pausePractice);
	const resetPractice = useThua((s) => s.resetPractice);
	const completePractice = useThua((s) => s.completePractice);
	const weeklyCap = useThua((s) => s.weeklyCap);
	const spends = useThua((s) => s.spends);
	const items = useThua((s) => s.items);
	const wants = useThua((s) => s.wants);
	const ticking = timer.running;
	const left = timerLeft(timer, useNow(ticking || wants.some((w) => w.status === "waiting") || items.some((i) => i.resolved === "open")));
	(0, import_react.useEffect)(() => {
		if (timer.running && left <= 0) completePractice();
	}, [
		timer.running,
		left,
		completePractice
	]);
	const today = vnDate();
	const done = practices.includes(today);
	const days = streak(practices, today);
	const paused = !timer.running && timer.remainingMs < 12e5;
	const spent = spentThisWeek(spends);
	const flow = flowThisWeek(items, spends);
	const holds = items.filter((i) => i.resolved === "open").length;
	const waiting = wants.filter((w) => w.status === "waiting").length;
	const capLeft = weeklyCap == null ? null : weeklyCap - spent;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-5xl leading-none text-fg",
					children: "Thưa"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted capitalize",
					children: vnLong()
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 max-w-xs text-lg leading-snug text-fg",
					children: "Ít đồ. Ít tiền ra. Nhiều chỗ để sống."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-card border border-line bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-widest text-muted uppercase",
						children: "Một việc"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-2 font-display text-3xl leading-tight",
						children: "Một hộc. Hai mươi phút."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Khóa máy cũng được. Đồng hồ chạy theo giờ thật, không theo màn hình."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 font-display text-6xl tabular-nums leading-none",
						"aria-live": "polite",
						children: formatClock(timer.running || paused ? left : PRACTICE_MS)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-sm text-muted",
						children: [done ? "Hôm nay đã giữ nhịp." : "Hôm nay chưa làm.", days > 0 ? ` ${days} ngày liên tiếp.` : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex flex-col gap-2",
						children: [
							!timer.running && !paused && !done && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: startPractice,
								children: "Bắt đầu 20 phút"
							}),
							timer.running && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: pausePractice,
								children: "Tạm dừng"
							}),
							paused && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: startPractice,
								children: "Tiếp tục"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								tone: "ghost",
								onClick: resetPractice,
								children: "Bỏ phiên này"
							})] }),
							!timer.running && !paused && done && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								tone: "quiet",
								onClick: startPractice,
								children: "Thêm một hộc"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onJump("money"),
					className: "tap rounded-card border border-line bg-surface p-4 text-left",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Tuần này còn"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-display text-2xl tabular-nums leading-none",
							children: capLeft == null ? "—" : formatMoney(Math.max(0, capLeft))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs text-muted",
							children: weeklyCap == null ? "Chưa đặt mức" : capLeft != null && capLeft < 0 ? `Vượt ${formatMoney(-capLeft)}` : `trong ${formatMoney(weeklyCap)}`
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onJump("release"),
					className: "tap rounded-card border border-line bg-surface p-4 text-left",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Đồ vào / ra"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 font-display text-2xl tabular-nums leading-none",
							children: [
								flow.inn,
								" · ",
								flow.out
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs text-muted",
							children: flow.inn === 0 && flow.out === 0 ? "Chưa có đồ mới" : flow.out >= flow.inn ? "Cửa ra đang rộng" : "Đồ vào nhiều hơn ra"
						})
					]
				})]
			}),
			(holds > 0 || waiting > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => onJump("wait"),
				className: "tap rounded-card border border-line bg-surface px-4 py-4 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-fg",
					children: [holds > 0 ? `${holds} món trong túi cửa` : "Túi cửa đang trống", waiting > 0 ? ` · ${waiting} thứ đang chờ mua` : ""]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted",
					children: "Mở hàng chờ"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "pt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-widest text-muted uppercase",
					children: "Bốn luật"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-3 flex flex-col",
					children: LAWS.map((law) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-4 border-t border-line py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-display text-sm text-accent",
							children: law.k
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm leading-relaxed",
							children: law.t
						})]
					}, law.k))
				})]
			})
		]
	});
}
function Release() {
	const decide = useThua((s) => s.decide);
	const items = useThua((s) => s.items);
	const [name, setName] = (0, import_react.useState)("");
	const [rebuy, setRebuy] = (0, import_react.useState)(null);
	const [guilt, setGuilt] = (0, import_react.useState)(null);
	const [life, setLife] = (0, import_react.useState)(null);
	const [override, setOverride] = (0, import_react.useState)(null);
	const [note, setNote] = (0, import_react.useState)("");
	const ready = name.trim().length > 0 && rebuy != null && guilt != null && life != null;
	const answers = rebuy != null && guilt != null && life != null ? {
		rebuy,
		guilt,
		currentLife: life
	} : null;
	const suggestion = answers ? suggest(answers) : null;
	const key = `${rebuy}-${guilt}-${life}`;
	const door = suggestion ? override && override.key === key ? override.door : suggestion.door : null;
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest text-muted uppercase",
				children: "Buông"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-display text-4xl leading-tight",
				children: "Ba câu, một cửa."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex flex-col gap-5",
				onSubmit: (e) => {
					e.preventDefault();
					commit();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Món đang nắm",
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "Áo mưa, cáp, hộp giày…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
						legend: "Nếu mất hôm nay, mình có mua lại?",
						value: rebuy,
						onChange: setRebuy,
						options: [{
							label: "Có, mua lại",
							value: true
						}, {
							label: "Không",
							value: false
						}]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
						legend: "Mình đang giữ vì điều gì?",
						value: guilt,
						onChange: setGuilt,
						options: [{
							label: "Tiếc tiền, tội lỗi",
							value: true
						}, {
							label: "Vì còn dùng",
							value: false
						}]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Choice, {
						legend: "Nó phục vụ đời nào?",
						value: life,
						onChange: setLife,
						options: [{
							label: "Đời đang sống",
							value: true
						}, {
							label: "Đời tưởng tượng",
							value: false
						}]
					}),
					suggestion && door && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-card border border-line bg-surface p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm leading-relaxed",
								children: suggestion.reason
							}),
							door !== suggestion.door && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs text-muted",
								children: "Đang chọn khác gợi ý. Quyết vẫn là của mình."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 grid grid-cols-2 gap-2",
								children: Object.keys(DOOR_LABEL).map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setOverride({
										key,
										door: d
									}),
									className: clsx("tap min-h-12 rounded-card border text-sm", door === d ? "border-accent bg-accent text-accent-fg" : "border-line bg-raised text-fg"),
									children: DOOR_LABEL[d]
								}, d))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
						type: "submit",
						disabled: !ready,
						children: "Chốt"
					}),
					note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: note
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest text-muted uppercase",
				children: "Vừa quyết"
			}), recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Chưa buông món nào. Bắt đầu bằng thứ đang nằm trên bàn."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2",
				children: recent.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "border-t border-line py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "min-w-0 break-words text-sm",
							children: item.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "shrink-0 text-xs text-muted",
							children: DOOR_LABEL[item.door]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted",
						children: item.resolved === "open" ? "Đang ở túi cửa" : item.resolved === "kept" ? "Đã giữ" : "Đã rời đi"
					})]
				}, item.id))
			})] })
		]
	});
}
function Wait() {
	const wants = useThua((s) => s.wants);
	const items = useThua((s) => s.items);
	const addWant = useThua((s) => s.addWant);
	const releaseWant = useThua((s) => s.releaseWant);
	const buyWant = useThua((s) => s.buyWant);
	const resolveHold = useThua((s) => s.resolveHold);
	const weeklyCap = useThua((s) => s.weeklyCap);
	const spends = useThua((s) => s.spends);
	const openHolds = items.filter((i) => i.door === "hold" && i.resolved === "open");
	const waiting = wants.filter((w) => w.status === "waiting");
	const now = useNow(openHolds.length > 0 || waiting.length > 0);
	const spent = spentThisWeek(spends);
	const room = weeklyCap == null ? null : weeklyCap - spent;
	const [name, setName] = (0, import_react.useState)("");
	const [price, setPrice] = (0, import_react.useState)("");
	const [trigger, setTrigger] = (0, import_react.useState)("sale");
	function add(e) {
		e.preventDefault();
		const n = Number(price);
		if (!name.trim() || !Number.isFinite(n) || n <= 0) return;
		addWant(name, n, trigger);
		setName("");
		setPrice("");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest text-muted uppercase",
				children: "Chờ"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-display text-4xl leading-tight",
				children: "Chưa mua, chưa vứt."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm text-fg",
					children: "Túi cửa"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Để món ở cửa một ngày. Hết giờ thì đưa đi, hoặc nhận lại là mình chọn giữ."
				}),
				openHolds.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: "Túi đang trống."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 flex flex-col gap-3",
					children: openHolds.map((item) => {
						const remain = (item.holdUntil ?? 0) - now;
						const due = remain <= 0;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-card border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "break-words text-sm",
									children: item.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted",
									children: formatRemain(remain)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										className: "flex-1",
										disabled: !due,
										onClick: () => resolveHold(item.id, "released"),
										children: "Đã cho đi"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										tone: "quiet",
										className: "flex-1",
										onClick: () => resolveHold(item.id, "kept"),
										children: "Giữ lại"
									})]
								})
							]
						}, item.id);
					})
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm text-fg",
					children: "48 giờ"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Thèm mua thì ghi ở đây. Đừng mở app shop trong lúc chờ."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: add,
					className: "mt-4 flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Thứ muốn mua",
							value: name,
							onChange: (e) => setName(e.target.value),
							placeholder: "Tai nghe, áo, đồ decor…"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoneyField, {
							label: "Giá",
							digits: price,
							onDigits: setPrice
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
							className: "mb-2 text-sm text-muted",
							children: "Đang cảm thấy"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: TRIGGERS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setTrigger(t.id),
								className: clsx("tap min-h-11 rounded-full border px-3 text-sm", trigger === t.id ? "border-accent bg-accent text-accent-fg" : "border-line text-muted"),
								children: t.label
							}, t.id))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							type: "submit",
							disabled: !name.trim() || Number(price) <= 0,
							children: "Để chờ"
						})
					]
				}),
				waiting.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-sm text-muted",
					children: "Chưa có thứ nào đang chờ."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 flex flex-col gap-3",
					children: waiting.map((want) => {
						const remain = want.readyAt - now;
						const due = remain <= 0;
						const triggerLabel = TRIGGERS.find((t) => t.id === want.trigger)?.label ?? "";
						const over = room != null && want.price > Math.max(0, room);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-card border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "min-w-0 break-words text-sm",
										children: want.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "shrink-0 font-display text-lg tabular-nums",
										children: formatMoney(want.price)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-muted",
									children: [
										triggerLabel,
										" · ",
										formatRemain(remain)
									]
								}),
								due && over && room != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 text-xs text-accent",
									children: [
										"Mua món này thì vượt mức tuần ",
										formatMoney(want.price - Math.max(0, room)),
										"."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex gap-2",
									children: [due ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										className: "flex-1",
										tone: over ? "quiet" : "solid",
										onClick: () => buyWant(want.id),
										children: "Vẫn mua, ghi chi"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "flex min-h-12 flex-1 items-center text-xs text-muted",
										children: "Chưa hết 48 giờ"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										tone: "ghost",
										onClick: () => releaseWant(want.id),
										children: "Không mua"
									})]
								})
							]
						}, want.id);
					})
				})
			] })
		]
	});
}
function Money() {
	const weeklyCap = useThua((s) => s.weeklyCap);
	const setCap = useThua((s) => s.setCap);
	const spends = useThua((s) => s.spends);
	const addSpend = useThua((s) => s.addSpend);
	const clearAll = useThua((s) => s.clearAll);
	const [capDigits, setCapDigits] = (0, import_react.useState)("");
	const [editing, setEditing] = (0, import_react.useState)(weeklyCap == null);
	const [amount, setAmount] = (0, import_react.useState)("");
	const [note, setNote] = (0, import_react.useState)("");
	const [thing, setThing] = (0, import_react.useState)(false);
	const [armedClear, setArmedClear] = (0, import_react.useState)(false);
	const spent = spentThisWeek(spends);
	const weekSpends = spends.filter((s) => s.weekId === weekId());
	const left = weeklyCap == null ? null : weeklyCap - spent;
	const ratio = weeklyCap && weeklyCap > 0 ? Math.min(1, spent / weeklyCap) : 0;
	function saveCap(e) {
		e.preventDefault();
		if (capDigits === "") return;
		setCap(Number(capDigits));
		setCapDigits("");
		setEditing(false);
	}
	function saveSpend(e) {
		e.preventDefault();
		const n = Number(amount);
		if (!Number.isFinite(n) || n <= 0) return;
		addSpend(n, note, thing);
		setAmount("");
		setNote("");
		setThing(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-widest text-muted uppercase",
					children: "Tiền"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-display text-4xl leading-tight",
					children: "Không thiết yếu."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Ăn cơ bản, đi lại, thuốc, hóa đơn không tính. Cà phê, sale, tự thưởng thì tính."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-card border border-line bg-surface p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Còn lại tuần này"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 font-display text-5xl tabular-nums leading-none",
						children: left == null ? "—" : formatMoney(Math.max(0, left))
					}),
					left != null && left < 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-accent",
						children: ["Vượt ", formatMoney(-left)]
					}),
					weeklyCap != null && weeklyCap > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 h-1 overflow-hidden rounded-full bg-raised",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-accent",
							style: { width: `${ratio * 100}%` }
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 text-sm text-muted",
						children: [
							"Đã ghi ",
							formatMoney(spent),
							weeklyCap != null ? ` / ${formatMoney(weeklyCap)}` : ""
						]
					}),
					!editing && weeklyCap != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "tap mt-3 text-sm text-muted",
						onClick: () => setEditing(true),
						children: "Đổi mức tuần"
					}),
					(editing || weeklyCap == null) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: saveCap,
						className: "mt-4 flex flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoneyField, {
							label: "Mức tuần",
							digits: capDigits,
							onDigits: setCapDigits
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							type: "submit",
							disabled: capDigits === "",
							children: "Đặt mức"
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: saveSpend,
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Đã mua rồi thì ghi, đừng giấu. Đang thèm thì sang tab Chờ, đừng ghi trước."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoneyField, {
						label: "Số tiền",
						digits: amount,
						onDigits: setAmount
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Là gì",
						value: note,
						onChange: (e) => setNote(e.target.value),
						placeholder: "Cà phê, áo, phí ship…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex min-h-12 items-center gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: thing,
							onChange: (e) => setThing(e.target.checked),
							className: "size-5"
						}), "Đây là đồ vật — tính vào cửa vào"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
						type: "submit",
						disabled: Number(amount) <= 0,
						children: "Ghi chi"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest text-muted uppercase",
				children: "Tuần này"
			}), weekSpends.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Chưa ghi khoản nào. Tuần tính từ thứ Hai."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2",
				children: weekSpends.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-baseline justify-between gap-3 border-t border-line py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "min-w-0 break-words text-sm",
						children: [s.note, s.thing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: " · đồ"
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "shrink-0 font-display tabular-nums",
						children: formatMoney(s.amount)
					})]
				}, s.id))
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pt-4",
				children: armedClear ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
						tone: "quiet",
						onClick: () => {
							clearAll();
							setArmedClear(false);
							setEditing(true);
						},
						children: "Chắc chắn xóa"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
						tone: "ghost",
						onClick: () => setArmedClear(false),
						children: "Thôi"
					})]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
					tone: "ghost",
					onClick: () => setArmedClear(true),
					children: "Xóa dữ liệu trên máy này"
				})
			})
		]
	});
}
function Choice({ legend, value, onChange, options }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
		className: "mb-2 text-sm leading-relaxed text-fg",
		children: legend
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid grid-cols-2 gap-2",
		children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pick, {
			on: value === option.value,
			onClick: () => onChange(option.value),
			children: option.label
		}, option.label))
	})] });
}
function Pick({ on, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: clsx("tap min-h-12 rounded-card border px-2 text-sm", on ? "border-accent bg-raised text-fg" : "border-line text-muted"),
		children
	});
}
function Field({ label, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-2 block text-sm text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			...props,
			className: "h-12 w-full rounded-card border border-line bg-surface px-4 text-base text-fg outline-none transition-colors duration-200 placeholder:text-muted focus:border-accent"
		})]
	});
}
function MoneyField({ label, digits, onDigits }) {
	const shown = digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
		label,
		inputMode: "numeric",
		autoComplete: "off",
		placeholder: "0",
		value: shown,
		onChange: (e) => onDigits(e.target.value.replace(/\D/g, "").slice(0, 9))
	});
}
function Btn({ tone = "solid", className, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: clsx("tap inline-flex min-h-12 items-center justify-center rounded-card px-4 text-sm font-medium disabled:opacity-40", tone === "solid" && "bg-accent text-accent-fg", tone === "quiet" && "border border-line bg-raised text-fg", tone === "ghost" && "text-muted", className),
		...props
	});
}
function useNow(active) {
	const [now, setNow] = (0, import_react.useState)(() => Date.now());
	(0, import_react.useEffect)(() => {
		if (!active) return;
		const id = window.setInterval(() => setNow(Date.now()), 1e3);
		return () => window.clearInterval(id);
	}, [active]);
	return active ? now : Date.now();
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThuaApp, {});
}
//#endregion
export { Home as component };
