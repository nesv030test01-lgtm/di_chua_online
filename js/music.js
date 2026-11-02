// Nhạc nền
//  - Nếu có file nhạc (CFG.file) trong repo → phát file đó (lặp lại, nhớ vị trí đang nghe, không hiện trình phát)
//  - Nếu không    → phát video YouTube bên dưới bằng trình phát nhúng (theo quy định của YouTube,
//                   trình phát phải hiển thị, tối thiểu 200×200)
// Thêm ?nhac=1 vào link để tự bật nhạc khi mở (dùng cho OBS).
const CFG = {
  youtubeId: "MAUTcJMEroE",
  file: "audio/tam-an-doi-nhe-nhang.m4a",
  volume: 40, // 0–100
};

const POS_KEY = "dichua-music-pos";

export function initMusic(toast = () => {}) {
  const btn = document.getElementById("btn-music");
  let mode = null, audio = null, player = null, panel = null, on = false;

  const setBtn = () => {
    btn.textContent = on ? "🔇 Tắt nhạc" : "🎵 Bật nhạc";
    btn.classList.toggle("on", on);
  };
  setBtn();
  btn.onclick = () => (on ? stop() : start());

  async function hasFile() {
    try { return (await fetch(CFG.file, { method: "HEAD", cache: "no-store" })).ok; } catch { return false; }
  }

  async function start() {
    on = true; setBtn();
    if (mode === null) mode = (await hasFile()) ? "file" : "youtube";
    if (mode === "file") {
      if (!audio) {
        audio = Object.assign(new Audio(CFG.file), { loop: true, volume: CFG.volume / 100, preload: "auto" });
        // Nghe tiếp từ chỗ lần trước
        try {
          const t = Number(localStorage.getItem(POS_KEY));
          if (t > 0) audio.addEventListener("loadedmetadata", () => { if (t < audio.duration - 5) audio.currentTime = t; }, { once: true });
        } catch {}
        setInterval(() => { if (!audio.paused) try { localStorage.setItem(POS_KEY, String(Math.floor(audio.currentTime))); } catch {} }, 5000);
      }
      audio.play().catch(() => { on = false; setBtn(); toast("Bấm 🎵 Bật nhạc để nghe"); });
    } else {
      openYouTube();
    }
  }

  function stop() {
    on = false; setBtn();
    audio?.pause();
    try { player?.destroy(); } catch {}
    player = null;
    panel?.remove();
    panel = null;
  }

  function openYouTube() {
    panel = document.createElement("div");
    panel.className = "yt-panel";
    const head = document.createElement("div");
    head.className = "yt-head";
    head.textContent = "🎵 Nhạc nền (kéo để di chuyển)";
    const close = document.createElement("button");
    close.textContent = "✕";
    close.title = "Tắt nhạc";
    close.onclick = stop;
    head.appendChild(close);
    const slot = document.createElement("div");
    slot.id = "yt-player";
    panel.append(head, slot);
    document.getElementById("stage").appendChild(panel);
    makeDraggable(panel, head);

    loadYT().then((YT) => {
      if (!panel) return;
      player = new YT.Player("yt-player", {
        width: 200, height: 200,
        videoId: CFG.youtubeId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, loop: 1, playlist: CFG.youtubeId, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e) => { e.target.setVolume(CFG.volume); e.target.playVideo(); },
          onError: (e) => {
            const msg = e.data === 101 || e.data === 150
              ? "Chủ video không cho phép nhúng video này vào trang khác."
              : "Không phát được video YouTube.";
            toast(msg);
            stop();
          },
        },
      });
    }).catch(() => { toast("Không tải được YouTube."); stop(); });
  }

  if (new URLSearchParams(location.search).get("nhac") === "1") start();
}

let ytPromise;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytPromise ||= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return ytPromise;
}

/** Kéo thanh tiêu đề để di chuyển trình phát */
function makeDraggable(panel, handle) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    const stage = panel.parentElement.getBoundingClientRect();
    const start = panel.getBoundingClientRect();
    const dx = e.clientX - start.left, dy = e.clientY - start.top;
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.min(Math.max(ev.clientX - dx - stage.left, 0), stage.width - start.width);
      const y = Math.min(Math.max(ev.clientY - dy - stage.top, 0), stage.height - start.height);
      Object.assign(panel.style, { left: x + "px", top: y + "px", bottom: "auto" });
    };
    const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
}
