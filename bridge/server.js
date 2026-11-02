// Cầu nối TikTok LIVE → game Đi Chùa Online
//
//   node server.js <tên_tiktok>     ví dụ: node server.js tranthanhhai.it
//   node server.js --demo           chạy thử với dữ liệu giả (không cần đang live)
//
// Sau đó mở http://localhost:8787/?live=1  (trong OBS: Browser Source, 1080×1920)
import http from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (process.argv[2] || "").trim();
const DEMO = !arg || arg === "--demo";
const username = DEMO ? "demo" : arg.replace(/.*tiktok\.com\/@?/, "").replace(/^@/, "").replace(/[/?].*$/, "");

// ---------- Máy chủ web: phục vụ game từ thư mục repo ----------
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp3": "audio/mpeg",
};
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/__audio-list") {
    // Danh sách bài nhạc trong thư mục audio/ (để game tự phát lần lượt)
    try {
      const files = (await readdir(path.join(ROOT, "audio")))
        .filter((f) => /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(files));
    } catch { res.writeHead(200, { "Content-Type": "application/json" }); return res.end("[]"); }
  }
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("..") || rel.startsWith("bridge") || rel.startsWith(".git")) {
    res.writeHead(403); return res.end("Forbidden");
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});

// ---------- WebSocket: đẩy sự kiện cho game ----------
const wss = new WebSocketServer({ server, path: "/ws" });
let status = { type: "status", state: "connecting", username, message: "Đang kết nối TikTok…" };
const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
const broadcast = (msg) => wss.clients.forEach((c) => send(c, msg));
wss.on("connection", (ws) => send(ws, status));
function setStatus(state, message) {
  status = { type: "status", state, username, message };
  broadcast(status);
  console.log(`[${new Date().toLocaleTimeString()}] ${state}${message ? " — " + message : ""}`);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n🪷  Đi Chùa Online — cầu nối TikTok LIVE");
  console.log(`   Mở game:  http://localhost:${PORT}/?live=1`);
  console.log(`   Tài khoản: ${DEMO ? "(chế độ thử — dữ liệu giả)" : "@" + username}\n`);
  if (DEMO) startDemo(); else connectTikTok();
});

// ---------- Chuẩn hoá dữ liệu TikTok ----------
function userOf(u = {}) {
  const pic = u.profilePicture?.url?.[0] || u.profilePicture?.urls?.[0] || u.avatarThumb?.urlList?.[0]
    || u.avatarMedium?.urlList?.[0] || u.profilePictureUrl || null;
  return {
    id: String(u.userId || u.id || u.uniqueId || u.displayId || u.nickname || Math.random()),
    name: String(u.nickname || u.uniqueId || u.displayId || "Thí chủ").slice(0, 24),
    avatar: pic,
  };
}

async function connectTikTok() {
  let lib;
  try { lib = await import("tiktok-live-connector"); }
  catch { console.error("Chưa cài thư viện. Chạy:  npm install"); process.exit(1); }
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;

  const conn = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });

  conn.on(WebcastEvent.CHAT, (d) => broadcast({ type: "chat", user: userOf(d.user), text: d.comment || "" }));
  conn.on(WebcastEvent.MEMBER, (d) => broadcast({ type: "join", user: userOf(d.user) }));
  conn.on(WebcastEvent.LIKE, (d) => broadcast({ type: "like", user: userOf(d.user), count: d.likeCount || 1 }));
  conn.on(WebcastEvent.ROOM_USER, (d) => {
    const n = d.viewerCount ?? d.total ?? d.totalUser;
    if (n != null) broadcast({ type: "viewers", count: Number(n) });
  });
  conn.on(WebcastEvent.GIFT, (d) => {
    const g = d.giftDetails || d.extendedGiftInfo || d;
    const giftType = g.giftType ?? d.giftType;
    // Quà dạng chuỗi (combo): chỉ tính khi kết thúc chuỗi
    if (giftType === 1 && !d.repeatEnd) return;
    broadcast({
      type: "gift",
      user: userOf(d.user),
      gift: { name: g.giftName || g.name || "Quà", diamonds: Number(g.diamondCount ?? g.diamond_count ?? 1), count: Number(d.repeatCount || 1) },
    });
  });
  conn.on(WebcastEvent.STREAM_END, () => { setStatus("ended", "Buổi live đã kết thúc"); retry(); });
  conn.on(ControlEvent.DISCONNECTED, () => { setStatus("offline", "Mất kết nối — đang thử lại"); retry(); });

  let retrying = false;
  function retry() {
    if (retrying) return;
    retrying = true;
    setTimeout(() => { retrying = false; tryConnect(); }, 15000);
  }
  async function tryConnect() {
    setStatus("connecting", `Đang kết nối @${username}…`);
    try {
      const st = await conn.connect();
      setStatus("connected", `Đã vào phòng live (roomId ${st.roomId})`);
    } catch (e) {
      setStatus("offline", `Chưa thấy @${username} đang live — thử lại sau 15 giây`);
      console.log("   chi tiết:", e?.message || e);
      retry();
    }
  }
  tryConnect();
}

// ---------- Dữ liệu giả ----------
function startDemo() {
  setStatus("demo", "Chế độ thử");
  const names = ["Mai", "Tờ Yn", "mnhi", "Hải Phong", "Bé Dâu", "Nguyễn An", "NekoNiii", "Cục Vàng", "Tuyết", "Bi Tân", "Ánh Dương", "Minh Khang"];
  const chats = ["thắp hương", "cầu an cho mẹ khỏe", "xin xăm", "Nam mô A Di Đà Phật", "gõ mõ", "chuông", "đẹp quá"];
  const gifts = [["Hoa hồng", 1], ["Kem", 1], ["Nhẫn", 5], ["Mũ", 99]];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const user = () => { const n = pick(names); return { id: "demo-" + n, name: n, avatar: null }; };
  const tick = () => {
    const r = Math.random();
    if (r < 0.15) broadcast({ type: "join", user: user() });
    else if (r < 0.85) broadcast({ type: "chat", user: user(), text: pick(chats) });
    else { const [name, diamonds] = pick(gifts); broadcast({ type: "gift", user: user(), gift: { name, diamonds, count: 1 } }); }
    if (Math.random() < 0.2) broadcast({ type: "viewers", count: 30 + Math.floor(Math.random() * 40) });
    setTimeout(tick, 1000 + Math.random() * 1800);
  };
  tick();
}
