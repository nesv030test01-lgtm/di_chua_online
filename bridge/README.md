# Cầu nối TikTok LIVE

Đọc bình luận, quà, lượt vào phòng từ buổi live TikTok của bạn và đẩy vào game.

## Cài lần đầu

1. Cài **Node.js** (bản LTS) từ https://nodejs.org
2. Mở **Terminal**, vào thư mục này rồi cài thư viện:
   ```bash
   cd "/Users/mac/Documents/AI Workflow & Transformation Blueprint/di_chua_online/di_chua_online/bridge"
   npm install
   ```

## Mỗi lần live

```bash
cd ".../di_chua_online/bridge"
node server.js TEN_TIKTOK_CUA_BAN      # vd: node server.js tranthanhhai.it
```
Hoặc thử trước không cần live: `node server.js --demo`

Mở **http://localhost:8787/?live=1** — đây là màn hình để đưa lên live.
Để Terminal chạy suốt buổi live (đóng Terminal = ngắt kết nối).

Xem `../README.md` phần "Livestream TikTok" để biết cách đưa lên OBS / TikTok LIVE Studio.
