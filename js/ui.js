// Vẽ giao diện: người quỳ, bảng xếp hạng, thông báo, hiệu ứng, hộp thoại
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

// ---- Vị trí người quỳ (phần trăm trong khung) ----
const ME_SLOT = { x: 50, y: 66, s: 1.3 };
const SLOTS = [
  // hàng đầu, hai bên mình
  { x: 34, y: 64.5, s: 1 }, { x: 66, y: 64.5, s: 1 },
  { x: 18, y: 64.5, s: 1 }, { x: 82, y: 64.5, s: 1 },
  // hai bên thảm
  { x: 32, y: 72.5, s: 1.08 }, { x: 68, y: 72.5, s: 1.08 },
  { x: 28, y: 80.5, s: 1.16 }, { x: 72, y: 80.5, s: 1.16 },
  // sát mép
  { x: 10, y: 72.5, s: 1.08 }, { x: 90, y: 72.5, s: 1.08 },
  { x: 10, y: 80.5, s: 1.16 }, { x: 90, y: 80.5, s: 1.16 },
];
export const MAX_OTHERS = SLOTS.length;

const FIG = `<svg class="fig-svg" viewBox="0 0 40 52" aria-hidden="true">
  <ellipse cx="20" cy="49" rx="17" ry="3.5" fill="rgba(0,0,0,.35)"/>
  <path d="M5 48 Q3 31 12 23 Q20 18 28 23 Q37 31 35 48 Z" fill="url(#g-robe)"/>
  <path d="M11 31 Q20 36 29 31" stroke="#b9b1a2" stroke-width="1" fill="none"/>
  <path d="M20 25 L20 47" stroke="#cfc8bb" stroke-width=".8"/>
  <circle cx="20" cy="15" r="7.2" fill="#2a1d18"/>
  <ellipse cx="20" cy="8.4" rx="3.4" ry="2.8" fill="#2a1d18"/>
</svg>`;

function makePerson(uid) {
  const el = document.createElement("div");
  el.className = "person";
  el.dataset.uid = uid;
  el.innerHTML = FIG + `<div class="tag"><span class="rank"></span><img class="ava" alt="" referrerpolicy="no-referrer"><span class="nm"></span></div>`;
  return el;
}

/** me = {uid,name,photoURL}; others = [...]; ranks = Map(uid → hạng) */
export function renderPeople(me, others, ranks) {
  const box = $("people");
  const want = new Map();
  if (me) want.set(me.uid, { ...me, slot: ME_SLOT, isMe: true });
  others.slice(0, SLOTS.length).forEach((u, i) => want.set(u.uid, { ...u, slot: SLOTS[i] }));

  [...box.children].forEach((el) => { if (!want.has(el.dataset.uid)) el.remove(); });

  for (const [uid, u] of want) {
    let el = [...box.children].find((c) => c.dataset.uid === uid);
    if (!el) { el = makePerson(uid); box.appendChild(el); }
    el.classList.toggle("me", !!u.isMe);
    el.style.left = u.slot.x + "%";
    el.style.top = u.slot.y + "%";
    el.style.setProperty("--s", u.slot.s);
    el.style.zIndex = Math.round(u.slot.y * 10);
    el.querySelector(".nm").textContent = u.name || "Thí chủ";
    const r = ranks.get(uid);
    const rk = el.querySelector(".rank");
    rk.textContent = r || "";
    rk.hidden = !r;
    const img = el.querySelector(".ava");
    if (u.photoURL && !r) { if (img.getAttribute("src") !== u.photoURL) img.src = u.photoURL; img.hidden = false; }
    else img.hidden = true;
  }
  $("online-count").textContent = fmt(want.size);
}

export function bow(uid) {
  const el = [...$("people").children].find((c) => c.dataset.uid === uid)?.querySelector(".fig-svg");
  if (!el) return;
  el.classList.remove("bow");
  void el.getBoundingClientRect();
  el.classList.add("bow");
}

export function renderBoard(list, myUid) {
  const ol = $("board-list");
  ol.innerHTML = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Chưa có ai — hãy là người đầu tiên 🙏";
    ol.appendChild(li);
    return;
  }
  list.forEach((u, i) => {
    const li = document.createElement("li");
    if (u.uid === myUid) li.className = "mine";
    const rk = document.createElement("span"); rk.className = "rank"; rk.textContent = i + 1;
    const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = u.name || "Thí chủ";
    const pt = document.createElement("span"); pt.className = "pts"; pt.textContent = fmt(u.congDuc);
    li.append(rk, nm, pt);
    ol.appendChild(li);
  });
}

export function renderStats(s) {
  $("tot-huong").textContent = fmt(s.huong);
  $("tot-cd").textContent = fmt(s.congDuc);
  $("tot-mo").textContent = fmt(s.goMo);
}

export function renderMe(me) {
  $("me-name").textContent = me.name || "Thí chủ";
  $("me-cd").textContent = fmt(me.congDuc);
  const img = $("me-ava");
  img.classList.toggle("hidden", !me.photoURL);
  if (me.photoURL && img.getAttribute("src") !== me.photoURL) img.src = me.photoURL;
}

// ---- Dòng thông báo hoạt động ----
const queue = [];
let busy = false;
export function pushBanner(text) {
  if (queue.length > 4) queue.shift();
  queue.push(text);
  if (!busy) nextBanner();
}
function nextBanner() {
  const b = $("banner");
  const t = queue.shift();
  if (!t) { busy = false; return; }
  busy = true;
  b.textContent = t;
  b.classList.add("show");
  setTimeout(() => { b.classList.remove("show"); setTimeout(nextBanner, 350); }, 2600);
}

// ---- Hiệu ứng ----
export function initPetals(n = 10) {
  const box = $("petals");
  if (box.childElementCount) return;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "petal";
    p.style.left = Math.random() * 100 + "%";
    p.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
    p.style.animationDuration = 9 + Math.random() * 8 + "s";
    p.style.animationDelay = -Math.random() * 15 + "s";
    p.style.transform = `scale(${0.6 + Math.random() * 0.7})`;
    box.appendChild(p);
  }
}

export function floatText(text) {
  const el = document.createElement("div");
  el.className = "float";
  el.textContent = text;
  el.style.left = 42 + Math.random() * 16 + "%";
  $("float-layer").appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

export function addIncense(initial = false) {
  const box = $("incense");
  const stick = document.createElement("div");
  stick.className = "stick";
  stick.innerHTML = '<span class="smoke"></span>';
  stick.style.height = 60 + Math.random() * 20 + "%";
  box.appendChild(stick);
  while (box.children.length > 11) box.firstChild.remove();
  // nén hương mới cháy dần trong ~40 giây
  if (!initial) setTimeout(() => { stick.style.transition = "height 40s linear"; stick.style.height = "22%"; }, 50);
}

export function offerLotus() {
  const el = document.createElement("div");
  el.className = "fly-lotus";
  el.textContent = "🪷";
  $("float-layer").appendChild(el);
  setTimeout(() => el.remove(), 1500);
  flashHalo();
}

export function flashHalo() {
  const h = $("halo");
  h.classList.remove("flash");
  void h.offsetWidth;
  h.classList.add("flash");
}

let audioCtx;
const ctx = () => (audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());

export function ringBell() {
  try {
    const c = ctx(), now = c.currentTime;
    [196, 392, 588, 784].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f * (1 + i * 0.003);
      g.gain.setValueAtTime(0.22 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4);
      o.connect(g).connect(c.destination);
      o.start(now); o.stop(now + 4);
    });
  } catch {}
  flashHalo();
}

export function knockMo() {
  try {
    const c = ctx(), now = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(820, now);
    o.frequency.exponentialRampToValueAtTime(520, now + 0.08);
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.connect(g).connect(c.destination);
    o.start(now); o.stop(now + 0.2);
  } catch {}
}

export function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

// ---- Hộp thoại & thông báo ----
let modalLocked = false;
export function openModal(build, { locked = false } = {}) {
  modalLocked = locked;
  const card = $("modal-card");
  card.innerHTML = "";
  build(card);
  $("modal").classList.remove("hidden");
}
export function unlockModal() { modalLocked = false; }
export function closeModal() {
  $("modal").classList.add("hidden");
  $("modal-card").innerHTML = "";
}
$("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal" && !modalLocked) closeModal();
});

/** Tạo phần tử nhanh: h("button", {class:"btn", onclick}, "Chữ") */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el[k] = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

export function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2800);
}

export { fmt };
