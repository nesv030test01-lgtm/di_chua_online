# 🪷 Đi Chùa Online

Game web nhiều người chơi: vào chùa, thấy những người khác đang quỳ lễ, dâng hương, cầu phúc, dâng hoa sen, thỉnh chuông, gõ mõ, xin xăm và tích công đức.
**Hosting:** GitHub Pages · **Đăng nhập:** Firebase Auth (Google + Khách) · **Dữ liệu:** Cloud Firestore

## Cấu trúc

```
index.html              Khung cảnh chùa + giao diện
css/style.css           Style
js/firebase-config.js   Config Firebase của bạn
js/firebase.js          Khởi tạo Firebase
js/auth.js              Đăng nhập Google / Khách / Liên kết khách → Google
js/db.js                Đọc/ghi Firestore (người đang viếng, bảng xếp hạng, hoạt động…)
js/ui.js                Vẽ người quỳ, bảng xếp hạng, hiệu ứng, hộp thoại
js/xam.js               Danh sách quẻ xăm
js/main.js              Logic game
firestore.rules         Luật bảo mật (dán vào Firebase Console)
```

## Dữ liệu trên Firestore

```
users/{uid}                 ai đăng nhập cũng xem được (để hiện tên + xếp hạng)
  name, photoURL, isGuest
  congDuc, huong, cauPhuc, hoaSen, chuong, goMo, xinXam
  lastSeen                  → dùng để biết ai "đang viếng" (2,5 phút gần nhất)
users/{uid}/prayers/{id}    lời cầu — RIÊNG TƯ, chỉ chủ nhân đọc được
stats/global                tổng hương / công đức / mõ của cả chùa
events/{id}                 dòng hoạt động: "A — Dâng 1 nén hương (+5 CĐ)"
```

| Hành động | Công đức | Thời gian chờ |
|---|---|---|
| Dâng hương | +5 | 4 giây |
| Cầu phúc (viết lời cầu) | +5 | — |
| Hoa sen | +3 | 3 giây |
| Thỉnh chuông | +1 | 1,5 giây |
| Gõ mõ | +1 | 1 giây |
| Xin xăm | 0 | — |

## Cài đặt Firebase (làm 1 lần)

1. https://console.firebase.google.com → tạo project.
2. **Authentication → Sign-in method**: bật **Google** và **Anonymous**.
3. **Authentication → Settings → Authorized domains**: thêm `nesv030test01-lgtm.github.io`.
4. **Firestore Database → Create database** (vùng `asia-southeast1`, Production mode).
5. **Firestore → Rules**: dán toàn bộ `firestore.rules` → **Publish**.
   ⚠️ Mỗi lần file `firestore.rules` thay đổi phải dán + Publish lại.
6. **Project settings → Your apps → Web** → copy `firebaseConfig` vào `js/firebase-config.js`.

## Chạy thử trên máy

```bash
python3 -m http.server 8000
```
Mở http://localhost:8000

## Đưa lên GitHub Pages

Commit + Push bằng GitHub Desktop → đợi ~1 phút → mở `https://nesv030test01-lgtm.github.io/di_chua_online/`.

**Khi sửa code:** tăng số phiên bản `?v=2` → `?v=3` ở 2 chỗ trong `index.html` (`css/style.css?v=` và `js/main.js?v=`) để người chơi không bị kẹt bản cũ trong bộ nhớ đệm.

## Giới hạn miễn phí (gói Spark)

~50.000 lượt đọc + 20.000 lượt ghi mỗi ngày. Mỗi hành động = 3 lượt ghi (người chơi + tổng chùa + dòng hoạt động); mỗi người online ghi thêm 1 lượt/phút để báo "đang viếng". Đủ cho vài chục người chơi đều đặn mỗi ngày.

Collection `events` sẽ lớn dần. Có thể bật xoá tự động: Firestore → **TTL** → thêm policy cho collection `events` (cần thêm trường hết hạn), hoặc thỉnh thoảng xoá tay.

## 🔴 Livestream TikTok (người xem bình luận / tặng quà → hiện trong chùa)

Chế độ LIVE không cần đăng nhập: mỗi người xem tương tác trên TikTok sẽ hiện thành một người quỳ lễ có tên, bảng "Tấm Lòng Thành" xếp theo công đức trong ngày.

| Người xem làm gì | Trong chùa |
|---|---|
| Vào phòng live | Hiện thành người quỳ + "X vừa vào chùa" |
| Bình luận **thắp hương** | Dâng hương, +5 CĐ |
| Bình luận **cầu an …** | Cầu an (hiện lời cầu ngắn), +5 CĐ |
| Bình luận **xin xăm** | Bật quẻ xăm mang tên người đó |
| Bình luận **chuông** / **gõ mõ** / **nam mô** | Thỉnh chuông / gõ mõ / niệm Phật, +1 CĐ |
| Tặng quà | Dâng hoa sen, +10 CĐ mỗi xu. Quà ≥ 5 xu: mưa hoa sen + chuông |

Cách chạy:
1. Làm theo `bridge/README.md` (cài Node.js, `npm install` 1 lần).
2. Mỗi lần live: `node server.js TEN_TIKTOK` trong thư mục `bridge`.
3. Đưa màn hình game lên live — chọn 1 trong 2:
   - **OBS:** thêm nguồn **Browser** → URL `http://localhost:8787/?live=1`, rộng 1080, cao 1920.
   - **TikTok LIVE Studio:** mở `http://localhost:8787/?live=1` bằng Chrome, rồi thêm nguồn **Window Capture** (quay cửa sổ) chọn cửa sổ Chrome đó.
4. Xem thử không cần live: `node server.js --demo`, hoặc mở trang web với `?live=demo`.

Lưu ý: thư viện đọc live (`tiktok-live-connector`) là thư viện **không chính thức**; TikTok có thể đổi giao thức khiến nó ngừng chạy tạm thời. Điểm/xếp hạng LIVE lưu trong trình duyệt theo ngày (không lên Firebase).

## 🎵 Nhạc nền

Bấm nút **🎵 Bật nhạc** (góc trên bên phải). Cấu hình ở đầu file `js/music.js`:
- Mặc định phát video YouTube bằng trình phát nhúng nhỏ (kéo thanh tiêu đề để di chuyển, ✕ để tắt). Theo quy định của YouTube, trình phát phải hiển thị, không được ẩn hay tách lấy âm thanh.
- Đang dùng file `audio/tam-an-doi-nhe-nhang.m4a` (phát lặp lại, nhớ chỗ đang nghe). Muốn đổi bài: chép file vào `audio/` rồi sửa dòng `file:` trong `js/music.js`. Nếu file không tồn tại, game dùng YouTube.
- Thêm `&nhac=1` vào link (vd. `http://localhost:8787/?live=1&nhac=1`) để tự bật nhạc khi mở trong OBS.

⚠️ Phát nhạc có bản quyền trên TikTok LIVE có thể bị tắt tiếng hoặc gỡ live. Nên dùng nhạc không bản quyền hoặc nhạc bạn được phép dùng.
