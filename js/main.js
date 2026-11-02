import { isConfigured } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const show = (id) => {
  ["screen-login", "screen-temple"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
  $("loading").classList.add("hidden");
};

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2500);
}

function floatText(text) {
  const el = document.createElement("div");
  el.className = "float";
  el.textContent = text;
  el.style.left = 40 + Math.random() * 20 + "%";
  $("float-layer").appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function cooldown(btn, ms) {
  btn.disabled = true;
  setTimeout(() => (btn.disabled = false), ms);
}

const errMsg = (e) =>
  ({
    "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập.",
    "auth/unauthorized-domain": "Domain này chưa được thêm vào Authorized domains trong Firebase.",
    "auth/admin-restricted-operation": "Chưa bật đăng nhập Anonymous trong Firebase Console.",
    "auth/operation-not-allowed": "Phương thức đăng nhập này chưa được bật trong Firebase Console.",
    "permission-denied": "Không có quyền ghi dữ liệu (kiểm tra Firestore Rules).",
  })[e?.code] || e?.message || "Có lỗi xảy ra.";

if (!isConfigured) {
  $("config-warning").classList.remove("hidden");
  show("screen-login");
  ["btn-google", "btn-guest"].forEach((id) => ($(id).disabled = true));
} else {
  start();
}

async function start() {
  const { watchAuth, loginGoogle, loginGuest, linkGuestToGoogle, logout } = await import("./auth.js");
  const db = await import("./db.js");

  let unsubs = [];
  let current = null;

  $("btn-google").onclick = () => loginGoogle().catch((e) => ($("login-error").textContent = errMsg(e)));
  $("btn-guest").onclick = () => loginGuest().catch((e) => ($("login-error").textContent = errMsg(e)));
  $("btn-logout").onclick = async () => {
    if (current?.isAnonymous && !confirm("Bạn đang là khách. Đăng xuất sẽ mất toàn bộ tiến trình nếu chưa liên kết Google. Tiếp tục?")) return;
    logout();
  };

  $("btn-link").onclick = async () => {
    try {
      const res = await linkGuestToGoogle();
      if (res.conflict) {
        if (confirm("Tài khoản Google này đã có dữ liệu từ trước. Chuyển sang tài khoản đó? (Tiến trình khách hiện tại sẽ không được gộp.)")) {
          await logout();
          await loginGoogle();
        }
        return;
      }
      await db.ensureUserDoc(res.user);
      toast("Đã liên kết Google. Tiến trình của bạn được giữ nguyên 🙏");
      renderUser(res.user);
    } catch (e) {
      toast(errMsg(e));
    }
  };

  $("btn-huong").onclick = async (ev) => {
    cooldown(ev.currentTarget, 3000);
    lightIncense();
    floatText("+3 công đức");
    db.thapHuong(current.uid).catch((e) => toast(errMsg(e)));
  };

  $("btn-chuong").onclick = async (ev) => {
    cooldown(ev.currentTarget, 1200);
    ringBell();
    floatText("+1 công đức");
    db.goChuong(current.uid).catch((e) => toast(errMsg(e)));
  };

  $("prayer-text").oninput = (e) => ($("prayer-count").textContent = `${e.target.value.length}/300`);
  $("btn-pray").onclick = async (ev) => {
    const text = $("prayer-text").value.trim();
    if (!text) return toast("Hãy viết lời nguyện trước nhé.");
    cooldown(ev.currentTarget, 3000);
    try {
      await db.guiLoiNguyen(current.uid, text);
      $("prayer-text").value = "";
      $("prayer-count").textContent = "0/300";
      floatText("+5 công đức");
    } catch (e) {
      toast(errMsg(e));
    }
  };

  watchAuth(async (user) => {
    unsubs.forEach((u) => u());
    unsubs = [];
    current = user;
    if (!user) return show("screen-login");

    try {
      await db.ensureUserDoc(user);
    } catch (e) {
      toast(errMsg(e));
    }
    renderUser(user);
    show("screen-temple");

    unsubs.push(
      db.watchUser(user.uid, (d) => {
        if (!d) return;
        $("stat-congduc").textContent = d.congDuc ?? 0;
        $("stat-huong").textContent = d.soLanThapHuong ?? 0;
        $("stat-chuong").textContent = d.soLanGoChuong ?? 0;
      }),
      db.watchPrayers(user.uid, (list) => {
        const ul = $("prayer-list");
        ul.innerHTML = "";
        list.forEach((p) => {
          const li = document.createElement("li");
          li.textContent = p.text; // textContent → an toàn, không chèn HTML
          ul.appendChild(li);
        });
      })
    );
  });

  function renderUser(user) {
    const google = user.providerData.find((p) => p.providerId === "google.com");
    $("user-name").textContent = google?.displayName || "Khách thập phương";
    $("user-type").textContent = user.isAnonymous ? "Khách (chưa liên kết)" : google?.email || "";
    $("btn-link").classList.toggle("hidden", !user.isAnonymous);
    const photo = google?.photoURL;
    $("avatar").classList.toggle("hidden", !photo);
    if (photo) $("avatar").src = photo;
  }
}

// ---- Hiệu ứng ----
let audioCtx;
function ringBell() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [220, 440, 660].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.25 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3);
      o.connect(g).connect(audioCtx.destination);
      o.start(now);
      o.stop(now + 3);
    });
  } catch {}
  document.querySelector(".pagoda").classList.remove("shake");
  void document.querySelector(".pagoda").offsetWidth;
  document.querySelector(".pagoda").classList.add("shake");
}

function lightIncense() {
  const box = $("incense");
  const stick = document.createElement("div");
  stick.className = "stick";
  stick.innerHTML = '<span class="smoke"></span>';
  box.appendChild(stick);
  if (box.children.length > 9) box.firstChild.remove();
  setTimeout(() => stick.classList.add("burnt"), 30000);
}
