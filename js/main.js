import { isConfigured } from "./firebase-config.js";

// Phiên bản lấy từ index.html (js/main.js?v=2) — tăng số này mỗi lần sửa code để trình duyệt tải bản mới
const V = new URL(import.meta.url).searchParams.get("v") || "0";
const $ = (id) => document.getElementById(id);

function show(id) {
  ["screen-login", "screen-temple"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
  $("loading").classList.add("hidden");
}

const errMsg = (e) =>
  ({
    "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập.",
    "auth/cancelled-popup-request": "Đang mở cửa sổ đăng nhập khác.",
    "auth/unauthorized-domain": "Domain này chưa được thêm vào Authorized domains trong Firebase.",
    "auth/admin-restricted-operation": "Chưa bật đăng nhập Anonymous trong Firebase Console.",
    "auth/operation-not-allowed": "Phương thức đăng nhập này chưa được bật trong Firebase Console.",
    "permission-denied": "Firestore từ chối (hãy Publish lại file firestore.rules mới nhất).",
  })[e?.code] || e?.message || "Có lỗi xảy ra.";

if (!isConfigured) {
  $("config-warning").classList.remove("hidden");
  show("screen-login");
  ["btn-google", "btn-guest"].forEach((id) => ($(id).disabled = true));
} else {
  start().catch((e) => {
    console.error(e);
    $("loading").textContent = "Không tải được game. Hãy kiểm tra mạng rồi tải lại trang.";
  });
}

async function start() {
  const [auth, db, ui, { XAM }] = await Promise.all([
    import(`./auth.js?v=${V}`),
    import(`./db.js?v=${V}`),
    import(`./ui.js?v=${V}`),
    import(`./xam.js?v=${V}`),
  ]);
  const { h } = ui;

  let user = null;
  let me = null;          // { uid, name, photoURL, congDuc, ... }
  let online = [];
  let ranks = new Map();
  let unsubs = [];
  let hbTimer = null;
  let lastErr = 0;

  db.setErrorHandler((e) => {
    console.warn(e);
    if (Date.now() - lastErr > 8000) { lastErr = Date.now(); ui.toast(errMsg(e)); }
  });

  // ---------- Đăng nhập ----------
  $("btn-google").onclick = () => auth.loginGoogle().catch((e) => ($("login-error").textContent = errMsg(e)));
  $("btn-guest").onclick = () => auth.loginGuest().catch((e) => ($("login-error").textContent = errMsg(e)));

  auth.watchAuth(async (u) => {
    cleanup();
    user = u;
    if (!u) { me = null; return show("screen-login"); }

    let data = {};
    try { data = await db.ensureUserDoc(u); } catch (e) { ui.toast(errMsg(e)); }
    me = { uid: u.uid, ...data };

    show("screen-temple");
    ui.initPetals();
    if (!$("incense").childElementCount) for (let i = 0; i < 3; i++) ui.addIncense(true);
    ui.renderMe(me);
    redraw();
    if (!me.name) askName(true);

    unsubs.push(
      db.watchUser(u.uid, (d) => { if (!d) return; me = { uid: u.uid, ...d }; ui.renderMe(me); redraw(); }),
      db.watchOnline((list) => { online = list; redraw(); }),
      db.watchTop((list) => {
        ranks = new Map(list.map((x, i) => [x.uid, i + 1]));
        ui.renderBoard(list, u.uid);
        redraw();
      }),
      db.watchStats(ui.renderStats),
      db.watchEvents((evt) => {
        const a = db.ACTIONS[evt.action];
        if (!a) return;
        ui.pushBanner(`🌸 ${evt.name} — ${a.icon} ${a.label}${a.points ? ` (+${a.points} CĐ)` : ""} 🌸`);
        ui.bow(evt.uid);
      }),
    );
    hbTimer = setInterval(() => {
      if (document.visibilityState === "visible") db.heartbeat(u.uid).catch(() => {});
    }, 60_000);
  });

  function cleanup() {
    unsubs.forEach((f) => f());
    unsubs = [];
    clearInterval(hbTimer);
    online = [];
    ranks = new Map();
  }

  function redraw() {
    if (!me) return;
    const others = online.filter((x) => x.uid !== me.uid && x.name);
    ui.renderPeople(me, others, ranks);
  }

  // ---------- Hành động ----------
  const COOLDOWN = { dangHuong: 4000, hoaSen: 3000, chuong: 1500, goMo: 1000 };
  const EFFECT = {
    dangHuong: () => ui.addIncense(),
    hoaSen: () => ui.offerLotus(),
    chuong: () => ui.ringBell(),
    goMo: () => ui.knockMo(),
    cauPhuc: () => ui.flashHalo(),
    xinXam: () => {},
  };

  function cooldown(btn, ms) {
    if (!ms) return;
    btn.disabled = true;
    setTimeout(() => (btn.disabled = false), ms);
  }

  function doAct(key, text) {
    const a = db.ACTIONS[key];
    EFFECT[key]();
    if (a.points) ui.floatText(`+${a.points} công đức`);
    return db.act(me.uid, me.name || "Thí chủ", key, text).catch((e) => ui.toast(errMsg(e)));
  }

  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!me) return;
      const key = btn.dataset.action;
      if (!me.name) return askName(true);
      if (key === "cauPhuc") return openPrayer();
      if (key === "xinXam") return openXam();
      ui.shake(btn);
      cooldown(btn, COOLDOWN[key]);
      doAct(key);
    });
  });

  // ---------- Hộp thoại: tên ----------
  function askName(first) {
    const input = h("input", { maxlength: 24, placeholder: "Ví dụ: Minh Tâm", value: me?.name || "" });
    const err = h("p", { class: "error" });
    const save = async (name) => {
      name = db.cleanName(name);
      if (!name) { err.textContent = "Hãy nhập tên (1–24 ký tự)."; return; }
      try {
        await db.setName(me.uid, name);
        me.name = name;
        ui.renderMe(me); redraw();
        ui.closeModal();
        if (first) ui.toast(`Chào ${name}, mời vào chùa 🙏`);
      } catch (e) { err.textContent = errMsg(e); }
    };
    ui.openModal((card) => {
      card.append(
        h("h2", {}, first ? "Xin cho biết tên của bạn" : "Đổi tên hiển thị"),
        h("p", {}, "Tên này sẽ hiện dưới hình người quỳ và trên bảng Tấm Lòng Thành."),
        input, err,
        h("div", { class: "row" },
          first ? h("button", { class: "btn btn-ghost", onclick: () => save(`Thí chủ ${me.uid.slice(0, 4)}`) }, "Để sau") : null,
          h("button", { class: "btn btn-gold", onclick: () => save(input.value) }, "Lưu"),
        ),
      );
      input.onkeydown = (e) => { if (e.key === "Enter") save(input.value); };
      setTimeout(() => input.focus(), 50);
    }, { locked: first });
  }

  // ---------- Hộp thoại: menu cá nhân ----------
  $("btn-me").onclick = () => {
    if (!me) return;
    ui.openModal((card) => {
      card.append(
        h("h2", {}, me.name || "Thí chủ"),
        h("p", {}, user.isAnonymous ? "Khách — chưa liên kết Google" : (user.email || "Tài khoản Google")),
        h("div", { class: "stats-mini" },
          h("div", {}, h("b", {}, ui.fmt(me.congDuc)), "Công đức"),
          h("div", {}, h("b", {}, ui.fmt(me.huong)), "Nén hương"),
          h("div", {}, h("b", {}, ui.fmt(me.hoaSen)), "Hoa sen"),
          h("div", {}, h("b", {}, ui.fmt(me.cauPhuc)), "Cầu phúc"),
          h("div", {}, h("b", {}, ui.fmt(me.chuong)), "Hồi chuông"),
          h("div", {}, h("b", {}, ui.fmt(me.goMo)), "Tiếng mõ"),
        ),
        h("button", { class: "btn btn-ghost", onclick: () => askName(false) }, "✏️ Đổi tên"),
        user.isAnonymous ? h("button", { class: "btn btn-google", onclick: linkGoogle }, h("span", { class: "g" }, "G"), " Liên kết Google để giữ tiến trình") : null,
        h("button", { class: "btn btn-ghost", onclick: logout }, "Đăng xuất"),
      );
    });
  };

  async function linkGoogle() {
    try {
      const res = await auth.linkGuestToGoogle();
      if (res.conflict) {
        if (confirm("Tài khoản Google này đã có dữ liệu từ trước. Chuyển sang tài khoản đó? (Tiến trình khách hiện tại sẽ không được gộp.)")) {
          ui.closeModal();
          await auth.logout();
          await auth.loginGoogle();
        }
        return;
      }
      await db.ensureUserDoc(res.user);
      ui.closeModal();
      ui.toast("Đã liên kết Google. Tiến trình được giữ nguyên 🙏");
    } catch (e) { ui.toast(errMsg(e)); }
  }

  async function logout() {
    if (user?.isAnonymous && !confirm("Bạn đang là khách. Đăng xuất sẽ mất toàn bộ tiến trình nếu chưa liên kết Google. Tiếp tục?")) return;
    ui.closeModal();
    auth.logout();
  }

  // ---------- Hộp thoại: cầu phúc ----------
  function openPrayer() {
    const ta = h("textarea", { maxlength: 300, rows: 3, placeholder: "Con xin cầu cho gia đình bình an, mạnh khỏe…" });
    const count = h("span", { class: "muted" }, "0/300");
    const list = h("ul", { class: "prayer-list" });
    const send = h("button", { class: "btn btn-gold" }, "🏮 Gửi lời cầu (+5 CĐ)");
    ta.oninput = () => (count.textContent = `${ta.value.length}/300`);
    send.onclick = async () => {
      const text = ta.value.trim();
      if (!text) return ui.toast("Hãy viết lời cầu trước nhé.");
      send.disabled = true;
      ui.closeModal();
      await doAct("cauPhuc", text);
    };
    ui.openModal((card) => {
      card.append(
        h("h2", {}, "🏮 Cầu phúc"),
        h("p", {}, "Lời cầu của bạn được giữ riêng tư — người khác chỉ thấy bạn vừa cầu phúc."),
        ta, h("p", {}, count), send,
        h("p", { style: "margin-top:14px" }, "Lời cầu gần đây của bạn:"), list,
      );
      setTimeout(() => ta.focus(), 50);
    });
    db.getMyPrayers(me.uid).then((ps) => {
      if (!ps.length) list.append(h("li", {}, "Chưa có lời cầu nào."));
      ps.forEach((p) => list.append(h("li", {}, "🙏 " + p.text)));
    }).catch(() => {});
  }

  // ---------- Hộp thoại: xin xăm ----------
  function openXam() {
    const tube = h("div", { class: "xam-tube shaking" }, "🎋");
    const body = h("div", {}, h("p", { style: "text-align:center" }, "Thành tâm khấn nguyện, lắc ống xăm…"));
    ui.openModal((card) => card.append(h("h2", { style: "text-align:center" }, "Xin xăm"), tube, body), { locked: true });
    ui.knockMo();
    setTimeout(() => {
      const q = XAM[Math.floor(Math.random() * XAM.length)];
      tube.classList.remove("shaking");
      tube.textContent = "📜";
      body.innerHTML = "";
      body.append(
        h("div", { class: "xam-card" },
          h("div", {}, `Quẻ số ${q.so}`),
          h("div", { class: "loai" }, q.loai),
          h("div", { class: "tho" }, ...q.tho.flatMap((l, i) => (i ? [h("br"), l] : [l]))),
          h("p", { class: "giai" }, "Lời giải: " + q.giai),
          h("p", { class: "disc" }, "Quẻ mang tính giải trí — tâm an là phúc."),
        ),
        h("button", { class: "btn btn-gold", onclick: ui.closeModal }, "Nam mô A Di Đà Phật 🙏"),
      );
      doAct("xinXam");
      ui.unlockModal(); // có quẻ rồi thì cho phép bấm ra ngoài để đóng
    }, 1600);
  }
}
