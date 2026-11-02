// Chế độ LIVE TikTok: người xem bình luận / tặng quà → hiện thành người quỳ lễ trong chùa.
// Mở bằng:  http://localhost:8787/?live=1      (cần chạy bridge/server.js trên máy)
//      hoặc: ...?live=demo                      (dữ liệu giả để xem thử, không cần TikTok)
const $ = (id) => document.getElementById(id);

const ACT = {
  dangHuong: { pts: 5, icon: "🔥", label: "Dâng 1 nén hương" },
  cauPhuc:   { pts: 5, icon: "🏮", label: "Cầu an" },
  chuong:    { pts: 1, icon: "🔔", label: "Thỉnh chuông" },
  goMo:      { pts: 1, icon: "🪵", label: "Gõ mõ" },
  niemPhat:  { pts: 1, icon: "📿", label: "Niệm Phật" },
  xinXam:    { pts: 0, icon: "🎋", label: "Xin xăm" },
};

// Bình luận → hành động (so khớp sau khi bỏ dấu, viết thường)
const RULES = [
  [/thap huong|dang huong|thap nhang/, "dangHuong"],
  [/cau an|cau phuc|cau binh an|cau suc khoe|cau tai loc/, "cauPhuc"],
  [/xin xam|xin que|gieo que/, "xinXam"],
  [/chuong/, "chuong"],
  [/go mo/, "goMo"],
  [/nam mo|a di da phat|adida/, "niemPhat"],
];
const XU_TO_CD = 10;           // 1 xu quà = 10 công đức
const ACTIVE_MS = 10 * 60_000; // hiện người xem đã tương tác trong 10 phút gần nhất
const SPAM_MS = 3000;          // cùng 1 người, cùng 1 hành động: chỉ tính điểm mỗi 3 giây

const HINTS = [
  "💬 Bình luận “thắp hương” để dâng hương",
  "💬 Bình luận “cầu an” để cầu phúc cho gia đình",
  "💬 Bình luận “xin xăm” để xin một quẻ",
  "🎁 Tặng quà để dâng hoa sen — quà càng lớn lễ càng long trọng",
  "💬 Bình luận “chuông” hoặc “gõ mõ” • “Nam mô A Di Đà Phật”",
];

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export function startLive(ui, XAM, mode) {
  const today = new Date().toISOString().slice(0, 10);
  const KEY = "dichua-live-" + today;
  let state = { users: {}, totals: { huong: 0, congDuc: 0, goMo: 0 } };
  try { state = JSON.parse(localStorage.getItem(KEY)) || state; } catch {}
  let viewerCount = null;
  let host = new URLSearchParams(location.search).get("user") || "";
  const lastAct = new Map();
  let lastBannerAt = 0;
  let lastJoinBanner = 0;

  // ---- Giao diện chế độ LIVE ----
  document.body.classList.add("live-mode");
  const labels = ["CMT “THẮP HƯƠNG”", "CMT “CẦU AN”", "TẶNG QUÀ"];
  document.querySelectorAll(".bottom-bar .big small").forEach((s, i) => (s.textContent = labels[i]));
  $("btn-me").onclick = null;
  setStatus("connecting", "Đang kết nối…");
  ui.initPetals(14);
  for (let i = 0; i < 4; i++) ui.addIncense(true);

  // Nút bấm: chủ live tự thao tác (để thử / làm mẫu)
  const HOST = { id: "host", name: "Chủ chùa", avatar: null };
  document.querySelectorAll("[data-action]").forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.action;
      if (k === "hoaSen") return onGift(HOST, { name: "Hoa sen", diamonds: 1, count: 1 });
      act(HOST, k === "dangHuong" ? "dangHuong" : k === "cauPhuc" ? "cauPhuc" : k);
    };
  });

  // ---- Lưu trữ + vẽ lại ----
  let saveT, drawQueued = false;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, 1000);
  }
  function draw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      const all = Object.values(state.users);
      const top = [...all].sort((a, b) => b.congDuc - a.congDuc).filter((u) => u.congDuc > 0).slice(0, 5);
      const ranks = new Map(top.map((u, i) => [u.uid, i + 1]));
      const now = Date.now();
      const active = all.filter((u) => now - u.lastActive < ACTIVE_MS).sort((a, b) => b.lastActive - a.lastActive);
      // Ngồi giữa: người đứng đầu bảng (nếu đang có mặt), không thì người tương tác gần nhất
      const center = active.find((u) => u.uid === top[0]?.uid) || active[0] || null;
      ui.renderPeople(center, active.filter((u) => u !== center), ranks);
      ui.renderBoard(top, center?.uid);
      ui.renderStats(state.totals);
      if (viewerCount != null) $("online-count").textContent = ui.fmt(viewerCount);
    });
  }

  function touch(user) {
    if (!user?.id) return null;
    let u = state.users[user.id];
    if (!u) u = state.users[user.id] = { uid: user.id, name: user.name || "Thí chủ", photoURL: user.avatar || null, congDuc: 0, lastActive: 0 };
    if (user.name) u.name = user.name.slice(0, 24);
    if (user.avatar) u.photoURL = user.avatar;
    u.lastActive = Date.now();
    draw();
    return u;
  }

  function banner(text) { lastBannerAt = Date.now(); ui.pushBanner(text); }

  // ---- Hành động ----
  function act(user, key, extra) {
    const u = touch(user);
    if (!u) return;
    const a = ACT[key];
    const spamKey = u.uid + key;
    const counted = Date.now() - (lastAct.get(spamKey) || 0) > SPAM_MS;
    lastAct.set(spamKey, Date.now());
    ui.bow(u.uid);
    if (!counted) return;

    if (key === "dangHuong") { ui.addIncense(); state.totals.huong++; }
    if (key === "chuong") ui.ringBell();
    if (key === "goMo") { ui.knockMo(); state.totals.goMo++; }
    if (key === "cauPhuc" || key === "niemPhat") ui.flashHalo();
    if (key === "xinXam") showXam(u);

    if (a.pts) {
      u.congDuc += a.pts;
      state.totals.congDuc += a.pts;
      ui.floatText(`+${a.pts} CĐ`);
    }
    const wish = key === "cauPhuc" && extra ? `: “${extra.slice(0, 40)}”` : "";
    banner(`🌸 ${u.name} — ${a.icon} ${a.label}${wish}${a.pts ? ` (+${a.pts} CĐ)` : ""} 🌸`);
    save(); draw();
  }

  function onChat(user, text) {
    const n = norm(text);
    const raw = (text || "").toLowerCase();
    let key = null;
    for (const [re, k] of RULES) if (re.test(n)) { key = k; break; }
    if (!key && raw.includes("mõ")) key = "goMo";
    if (key) act(user, key, key === "cauPhuc" ? text : null);
    else touch(user); // bình luận thường: vẫn hiện người đó trong chùa
  }

  function onGift(user, gift) {
    const u = touch(user);
    if (!u) return;
    const xu = Math.max(1, (gift.diamonds || 1) * (gift.count || 1));
    const pts = xu * XU_TO_CD;
    u.congDuc += pts;
    state.totals.congDuc += pts;
    ui.bow(u.uid);
    const lotuses = Math.min(1 + Math.floor(xu / 5), 12);
    for (let i = 0; i < lotuses; i++) setTimeout(() => ui.offerLotus(), i * 180);
    if (xu >= 5) { ui.ringBell(); ui.lotusRain(Math.min(10 + xu, 60)); }
    ui.floatText(`+${ui.fmt(pts)} CĐ`);
    const what = gift.count > 1 ? `${gift.count}× ${gift.name}` : gift.name;
    banner(`🪷 ${u.name} dâng ${what} (+${ui.fmt(pts)} CĐ) 🪷`);
    save(); draw();
  }

  // ---- Xin xăm (lần lượt từng người) ----
  const xamQueue = [];
  let xamBusy = false;
  function showXam(u) {
    if (xamQueue.length < 5) xamQueue.push(u);
    if (!xamBusy) nextXam();
  }
  function nextXam() {
    const u = xamQueue.shift();
    if (!u) { xamBusy = false; return; }
    xamBusy = true;
    const q = XAM[Math.floor(Math.random() * XAM.length)];
    const { h } = ui;
    ui.openModal((card) => card.append(
      h("h2", { style: "text-align:center" }, `🎋 Quẻ của ${u.name}`),
      h("div", { class: "xam-card" },
        h("div", {}, `Quẻ số ${q.so}`),
        h("div", { class: "loai" }, q.loai),
        h("div", { class: "tho" }, ...q.tho.flatMap((l, i) => (i ? [h("br"), l] : [l]))),
        h("p", { class: "giai" }, "Lời giải: " + q.giai),
        h("p", { class: "disc" }, "Quẻ mang tính giải trí — tâm an là phúc."),
      ),
    ), { locked: true });
    setTimeout(() => { ui.closeModal(); setTimeout(nextXam, 400); }, 8000);
  }

  // ---- Gợi ý khi không có hoạt động ----
  let hintI = 0;
  setInterval(() => {
    if (Date.now() - lastBannerAt > 7000) { ui.pushBanner(HINTS[hintI++ % HINTS.length]); lastBannerAt = Date.now(); }
  }, 2000);
  setInterval(draw, 30_000); // dọn người đã rời

  // ---- Nhận sự kiện ----
  function handle(m) {
    switch (m.type) {
      case "status": host = m.username || host; setStatus(m.state, m.message); break;
      case "viewers": viewerCount = m.count; draw(); break;
      case "join": {
        touch(m.user);
        if (Date.now() - lastJoinBanner > 4000 && Date.now() - lastBannerAt > 2500) {
          lastJoinBanner = Date.now();
          banner(`🙏 ${m.user.name} vừa vào chùa`);
        }
        break;
      }
      case "chat": onChat(m.user, m.text); break;
      case "gift": onGift(m.user, m.gift); break;
      case "like": touch(m.user); if (Math.random() < 0.3) ui.lotusRain(3); break;
    }
  }

  function setStatus(st, msg) {
    const live = st === "connected" || st === "demo";
    const text = live ? `🔴 LIVE${host ? " @" + host : ""}` : `⚪ ${msg || "Đang chờ live…"}`;
    $("btn-me").textContent = text;
    $("btn-me").classList.toggle("is-live", live);
  }

  if (mode === "demo") {
    host = "demo";
    setStatus("demo");
    demoFeed(handle);
  } else {
    connect();
  }

  function connect() {
    const p = new URLSearchParams(location.search);
    const url = p.get("ws") || `ws://${location.hostname === "localhost" || location.hostname === "127.0.0.1" ? location.host : "localhost:8787"}/ws`;
    let ws;
    try { ws = new WebSocket(url); } catch { return setTimeout(connect, 3000); }
    ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) { console.warn(err); } };
    ws.onclose = () => { setStatus("offline", "Mất kết nối bridge — đang thử lại…"); setTimeout(connect, 3000); };
  }

  draw();
}

// ---- Dữ liệu giả để xem thử ----
export function demoFeed(emit) {
  const names = ["Mai", "Tờ Yn", "mnhi", "Hải Phong", "Bé Dâu", "Nguyễn An", "NekoNiii", "Cục Vàng", "Tuyết", "Bi Tân", "Ánh Dương", "Minh Khang", "Thu Hà", "Gia Bảo", "Lan Chi"];
  const chats = ["thắp hương", "cầu an cho mẹ khỏe", "xin xăm", "Nam mô A Di Đà Phật", "gõ mõ", "chuông", "thắp hương ạ", "cầu an gia đình bình an", "hello", "đẹp quá"];
  const gifts = [["Hoa hồng", 1], ["Hoa sen", 1], ["Kem", 1], ["Nhẫn", 5], ["Mũ", 99]];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const user = () => { const n = pick(names); return { id: "demo-" + n, name: n, avatar: null }; };
  emit({ type: "viewers", count: 37 });
  const tick = () => {
    const r = Math.random();
    if (r < 0.15) emit({ type: "join", user: user() });
    else if (r < 0.8) emit({ type: "chat", user: user(), text: pick(chats) });
    else if (r < 0.95) { const [name, d] = pick(gifts.slice(0, 4)); emit({ type: "gift", user: user(), gift: { name, diamonds: d, count: 1 + Math.floor(Math.random() * 3) } }); }
    else { const [name, d] = gifts[4]; emit({ type: "gift", user: user(), gift: { name, diamonds: d, count: 1 } }); }
    if (Math.random() < 0.2) emit({ type: "viewers", count: 30 + Math.floor(Math.random() * 40) });
    setTimeout(tick, 900 + Math.random() * 1800);
  };
  tick();
}
