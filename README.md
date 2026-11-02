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
