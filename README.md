# 🪷 Đi Chùa Online

Game web nhỏ: thắp hương, gõ chuông, gửi lời nguyện cầu, tích công đức.
**Hosting:** GitHub Pages · **Đăng nhập:** Firebase Auth (Google + Khách) · **Dữ liệu:** Cloud Firestore

## Cấu trúc

```
index.html              Giao diện
css/style.css           Style
js/firebase-config.js   ← DÁN CONFIG FIREBASE CỦA BẠN VÀO ĐÂY
js/firebase.js          Khởi tạo Firebase
js/auth.js              Đăng nhập Google / Khách / Liên kết khách → Google
js/db.js                Đọc/ghi Firestore
js/main.js              Logic game + hiệu ứng
firestore.rules         Luật bảo mật (dán vào Firebase Console)
```

Dữ liệu trên Firestore:

```
users/{uid}
  displayName, photoURL, isGuest
  congDuc, soLanThapHuong, soLanGoChuong
  createdAt, lastVisit
users/{uid}/prayers/{id}
  text, createdAt
```

## Bước 1 — Tạo Firebase project

1. Vào https://console.firebase.google.com → **Add project** (có thể tắt Google Analytics).
2. **Build → Authentication → Get started → Sign-in method**, bật:
   - **Google** (chọn email hỗ trợ rồi Save)
   - **Anonymous**
3. **Build → Firestore Database → Create database** → chọn vùng gần (vd. `asia-southeast1`) → **Production mode**.
4. Tab **Rules** của Firestore → xoá hết, dán nội dung file `firestore.rules` → **Publish**.
5. **Project settings (⚙️) → General → Your apps → Web (</>)** → đặt tên → **Register app** → copy object `firebaseConfig` dán vào `js/firebase-config.js`.

> Config này công khai trên GitHub là **bình thường**. Thứ bảo vệ dữ liệu là `firestore.rules`.

## Bước 2 — Chạy thử trên máy

Do dùng ES modules nên phải chạy qua web server (không mở file trực tiếp):

```bash
cd di_chua_online
python3 -m http.server 8000
```

Mở http://localhost:8000 (localhost đã được Firebase cho phép sẵn).

## Bước 3 — Đưa lên GitHub Pages

```bash
git init
git add .
git commit -m "Đi Chùa Online - bản đầu"
git branch -M main
git remote add origin https://github.com/<TEN_BAN>/di_chua_online.git
git push -u origin main
```

1. Trên GitHub repo → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)` → Save.
2. Sau 1–2 phút trang có ở `https://<TEN_BAN>.github.io/di_chua_online/`.
3. **Quan trọng:** Firebase Console → Authentication → **Settings → Authorized domains** → **Add domain** → `<TEN_BAN>.github.io`. Thiếu bước này đăng nhập Google sẽ báo lỗi `auth/unauthorized-domain`.

## Cách hoạt động của tài khoản Khách

- Bấm "Vào chùa với tư cách khách" → Firebase tạo một `uid` ẩn danh, dữ liệu vẫn lưu lên Firestore.
- Khách bấm **Liên kết Google** → `uid` giữ nguyên, toàn bộ công đức được giữ lại.
- Nếu khách **đăng xuất** hoặc xoá dữ liệu trình duyệt trước khi liên kết → mất tiến trình (game có cảnh báo).
- Nếu tài khoản Google đó đã từng chơi riêng → không gộp được, game hỏi có muốn chuyển sang tài khoản đó không.

## Giới hạn miễn phí (gói Spark)

Firestore: ~50.000 lượt đọc + 20.000 lượt ghi mỗi ngày. Mỗi lần thắp hương/gõ chuông = 1 lượt ghi; game đã có thời gian chờ giữa các lần bấm để tiết kiệm.

## Ý tưởng mở rộng

- Bảng xếp hạng công đức (collection `leaderboard` công khai, chỉ đọc)
- Nhiều ngôi chùa (Chùa Một Cột, Bái Đính, Thiên Mụ…) mở khoá theo công đức
- Sổ nguyện cầu chung, đếm số người đang viếng chùa
- Lịch rằm / mùng 1 nhận công đức nhân đôi
